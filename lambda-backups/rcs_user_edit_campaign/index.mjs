import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand,
    QueryCommand
} from "@aws-sdk/lib-dynamodb";

import {
    LambdaClient,
    InvokeCommand
} from "@aws-sdk/client-lambda";

// =====================================================
// AWS CONFIG
// =====================================================

const client = new DynamoDBClient({
    region: "ap-south-1"
});

const docClient =
    DynamoDBDocumentClient.from(client);

const lambdaClient =
    new LambdaClient({
        region: "ap-south-1"
    });

// =====================================================
// TABLES
// =====================================================

const CAMPAIGN_TABLE =
    "rcs_campaign";

const BLACKLIST_TABLE =
    "rcs_user_blacklist_numbers";

// =====================================================
// MAIN HANDLER
// =====================================================

export const handler = async (event) => {

    try {

        // =================================================
        // REQUEST BODY
        // =================================================

        const body = event;

        const {

            campaignId,

            campaignName,

            bot,

            campaignForm,

            template,

            timezone,

            campaignType,

            numbers,

            fileUrl,

            group,

            runType,

            scheduleDate,
            scheduleTime,

            expiryDate,
            expiryTime

        } = body;

        // =================================================
        // REQUIRED FIELD
        // =================================================

        if (!campaignId) {

            return response(
                400,
                "campaignId is required"
            );
        }

        // =================================================
        // CHECK CAMPAIGN EXISTS
        // =================================================

        const campaignData =
            await docClient.send(
                new GetCommand({
                    TableName:
                        CAMPAIGN_TABLE,
                    Key: {
                        id: campaignId
                    }
                })
            );

        if (!campaignData.Item) {

            return response(
                404,
                "Campaign not found"
            );
        }

        // =================================================
        // EXISTING DATA
        // =================================================

        const existingCampaign =
            campaignData.Item;

        // =================================================
        // FINAL VALUES
        // =================================================

        const finalCampaignForm =
            campaignForm ||
            existingCampaign.campaignForm;

        const finalCampaignType =
            campaignType ||
            existingCampaign.campaignType;

        const finalRunType =
            runType ||
            existingCampaign.runType;

        // =================================================
        // VALIDATE CAMPAIGN FORM
        // =================================================

        if (
            finalCampaignForm !== "text" &&
            finalCampaignForm !== "rich"
        ) {

            return response(
                400,
                "campaignForm must be text or rich"
            );
        }

        // =================================================
        // TEXT CAMPAIGN CANNOT HAVE TEMPLATE
        // =================================================

        if (
            finalCampaignForm === "text" &&
            template
        ) {

            return response(
                400,
                "Template not allowed for text campaign"
            );
        }

        // =================================================
        // FINAL VALID NUMBERS
        // =================================================

        let validNumbers =
            existingCampaign.numbers || [];

        // =================================================
        // QUICK CAMPAIGN
        // =================================================

        if (
            finalCampaignType ===
            "quick-campaign"
        ) {

            // =============================================
            // IF NEW NUMBERS PROVIDED
            // =============================================

            if (
                numbers &&
                numbers.length > 0
            ) {

                let invalidNumbers = [];

                validNumbers = numbers
                    .map((num) => {

                        const normalized =
                            normalizeNumber(num);

                        if (!normalized) {

                            invalidNumbers.push(num);
                        }

                        return normalized;

                    })
                    .filter(Boolean);

                // =========================================
                // INVALID NUMBERS
                // =========================================

                if (
                    invalidNumbers.length > 0
                ) {

                    return response(400, {

                        message:
                            "Invalid phone numbers found",

                        invalidNumbers
                    });
                }

                // =========================================
                // REMOVE DUPLICATES
                // =========================================

                validNumbers =
                    [...new Set(validNumbers)];

                // =========================================
                // REMOVE BLACKLISTED
                // =========================================

                const blacklistResult =
                    await removeBlacklistedNumbers(
                        validNumbers
                    );

                validNumbers =
                    blacklistResult.validNumbers;

                // =========================================
                // ALL BLACKLISTED
                // =========================================

                if (
                    validNumbers.length === 0
                ) {

                    return response(
                        400,
                        "All numbers are blacklisted"
                    );
                }
            }
        }

        // =================================================
        // BULK CAMPAIGN
        // =================================================

        else if (
            finalCampaignType ===
            "bulk-campaign"
        ) {

            // =============================================
            // IF FILE UPDATED
            // =============================================

            if (fileUrl) {

                const csvPayload = {
                    fileUrl
                };

                // =========================================
                // VALIDATE CSV
                // =========================================

                const csvResponse =
                    await validateCSVNumbers(
                        csvPayload
                    );

                // =========================================
                // CSV ERROR
                // =========================================

                if (
                    csvResponse.statusCode &&
                    csvResponse.statusCode !== 200
                ) {

                    return csvResponse;
                }

                // =========================================
                // GET CSV NUMBERS
                // =========================================

                const {
                    numbers:
                        processedNumbers
                } = csvResponse;

                validNumbers =
                    [...new Set(
                        processedNumbers
                    )];

                // =========================================
                // REMOVE BLACKLISTED
                // =========================================

                const blacklistResult =
                    await removeBlacklistedNumbers(
                        validNumbers
                    );

                validNumbers =
                    blacklistResult.validNumbers;

                // =========================================
                // ALL BLACKLISTED
                // =========================================

                if (
                    validNumbers.length === 0
                ) {

                    return response(
                        400,
                        "All numbers are blacklisted"
                    );
                }
            }
        }

        // =================================================
        // RUN TYPE VALIDATION
        // =================================================

        if (
            finalRunType ===
            "run-now"
        ) {

            if (
                !(
                    expiryDate ||
                    existingCampaign.expiryDate
                ) ||
                !(
                    expiryTime ||
                    existingCampaign.expiryTime
                )
            ) {

                return response(
                    400,
                    "expiryDate and expiryTime required"
                );
            }
        }

        // =================================================
        // RUN LATER
        // =================================================

        else if (
            finalRunType ===
            "run-later"
        ) {

            if (
                !(
                    scheduleDate ||
                    existingCampaign.scheduleDate
                ) ||
                !(
                    scheduleTime ||
                    existingCampaign.scheduleTime
                )
            ) {

                return response(
                    400,
                    "scheduleDate and scheduleTime required"
                );
            }

            if (
                !(
                    expiryDate ||
                    existingCampaign.expiryDate
                ) ||
                !(
                    expiryTime ||
                    existingCampaign.expiryTime
                )
            ) {

                return response(
                    400,
                    "expiryDate and expiryTime required"
                );
            }
        }

        // =================================================
        // UPDATED TIME
        // =================================================

        const updatedAt =
            new Date().toISOString();

        // =================================================
        // UPDATE CAMPAIGN
        // =================================================

        await docClient.send(
            new UpdateCommand({

                TableName:
                    CAMPAIGN_TABLE,

                Key: {
                    id: campaignId
                },

                UpdateExpression: `
                    SET
                    campaignName = :campaignName,
                    bot = :bot,
                    campaignForm = :campaignForm,
                    #template = :template,
                    #timezone = :timezone,
                    campaignType = :campaignType,
                    numbers = :numbers,
                    totalValidNumbers = :totalValidNumbers,
                    #group = :group,
                    fileUrl = :fileUrl,
                    runType = :runType,
                    scheduleDate = :scheduleDate,
                    scheduleTime = :scheduleTime,
                    expiryDate = :expiryDate,
                    expiryTime = :expiryTime,
                    updatedAt = :updatedAt
                `,
               
                ExpressionAttributeNames: {
                    "#timezone": "timezone",
                    "#group": "group",
                    "#template": "template"
                    
                },
                ExpressionAttributeValues: {

                    ":campaignName":
                        campaignName ||
                        existingCampaign.campaignName,

                    ":bot":
                        bot ||
                        existingCampaign.bot,

                    ":campaignForm":
                        finalCampaignForm,

                    ":template":
                        finalCampaignForm ===
                        "rich"
                            ? (
                                template !== undefined
                                    ? template
                                    : existingCampaign.template
                            )
                            : null,

                    ":timezone":
                        timezone ||
                        existingCampaign.timezone,

                    ":campaignType":
                        finalCampaignType,

                    ":numbers":
                        validNumbers,

                    ":totalValidNumbers":
                        validNumbers.length,

                    ":group":
                        group !== undefined
                            ? group
                            : existingCampaign.group,

                    ":fileUrl":
                        fileUrl !== undefined
                            ? fileUrl
                            : existingCampaign.fileUrl,

                    ":runType":
                        finalRunType,

                    ":scheduleDate":
                        scheduleDate !== undefined
                            ? scheduleDate
                            : existingCampaign.scheduleDate,

                    ":scheduleTime":
                        scheduleTime !== undefined
                            ? scheduleTime
                            : existingCampaign.scheduleTime,

                    ":expiryDate":
                        expiryDate !== undefined
                            ? expiryDate
                            : existingCampaign.expiryDate,

                    ":expiryTime":
                        expiryTime !== undefined
                            ? expiryTime
                            : existingCampaign.expiryTime,

                    ":updatedAt":
                        updatedAt
                }
            })
        );

        // =================================================
        // SUCCESS RESPONSE
        // =================================================

        return response(200, {

            message:
                "Campaign updated successfully",

            campaignId
        });

    } catch (error) {

        console.error(error);

        return response(
            500,
            error.message
        );
    }
};

// =====================================================
// MOBILE NUMBER VALIDATION
// =====================================================

const normalizeNumber = (num) => {

    if (!num) return null;

    const original =
        num.toString().trim();

    // =================================================
    // REJECT LETTERS
    // =================================================

    if (
        /[a-zA-Z]/.test(original)
    ) {

        return null;
    }

    // =================================================
    // REJECT +
    // =================================================

    if (
        original.includes("+")
    ) {

        return null;
    }

    // =================================================
    // ALLOW ONLY DIGITS SPACE DASH
    // =================================================

    if (
        !/^[\d\-\s]+$/.test(original)
    ) {

        return null;
    }

    // =================================================
    // REMOVE SPACE DASH
    // =================================================

    let cleaned =
        original.replace(
            /[\s\-]/g,
            ""
        );

    // =================================================
    // REMOVE 91
    // =================================================

    if (
        cleaned.length === 12 &&
        cleaned.startsWith("91")
    ) {

        cleaned =
            cleaned.slice(2);
    }

    // =================================================
    // VALIDATE 10 DIGITS
    // =================================================

    if (
        !/^[6-9]\d{9}$/.test(cleaned)
    ) {

        return null;
    }

    // =================================================
    // RETURN WITH 91
    // =================================================

    return "91" + cleaned;
};

// =====================================================
// REMOVE BLACKLISTED NUMBERS
// =====================================================

const removeBlacklistedNumbers =
    async (numbers) => {

        const validNumbers = [];

        const blacklistedNumbers = [];

        for (const number of numbers) {

            const blacklistData =
                await docClient.send(
                    new QueryCommand({

                        TableName:
                            BLACKLIST_TABLE,

                        IndexName:
                            "number-index",

                        KeyConditionExpression:
                            "#number = :number",

                        ExpressionAttributeNames: {
                            "#number":
                                "number"
                        },

                        ExpressionAttributeValues: {
                            ":number":
                                number
                        }
                    })
                );

            // =========================================
            // BLACKLISTED
            // =========================================

            if (
                blacklistData.Items &&
                blacklistData.Items.length > 0
            ) {

                blacklistedNumbers.push(
                    number
                );

            } else {

                validNumbers.push(
                    number
                );
            }
        }

        return {
            validNumbers,
            blacklistedNumbers
        };
    };

// =====================================================
// CSV VALIDATION LAMBDA
// =====================================================

const validateCSVNumbers =
    async (payload) => {

        const command =
            new InvokeCommand({

                FunctionName:
                    "rcs_campaignToCsv",

                InvocationType:
                    "RequestResponse",

                Payload: Buffer.from(
                    JSON.stringify(payload)
                )
            });

        const response =
            await lambdaClient.send(
                command
            );

        const result = JSON.parse(
            new TextDecoder().decode(
                response.Payload
            )
        );

        // =============================================
        // CSV ERROR
        // =============================================

        if (
            result.statusCode &&
            result.statusCode !== 200
        ) {

            return result;
        }

        const body =
            typeof result.body ===
            "string"
                ? JSON.parse(result.body)
                : result;

        return {
            statusCode: 200,
            numbers:
                body.numbers || []
        };
    };

// =====================================================
// RESPONSE HELPER
// =====================================================

const response = (
    statusCode,
    body
) => ({

    statusCode,

    body: JSON.stringify(body)
});
























// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//     DynamoDBDocumentClient,
//     GetCommand,
//     UpdateCommand
// } from "@aws-sdk/lib-dynamodb";
// import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);
// const lambdaClient = new LambdaClient({ region: "ap-south-1" });

// const USER_TABLE = "rcs_admin_and_users";
// const CREDIT_TABLE = "rcs_credit";
// const CAMPAIGN_TABLE = "rcs_campaign";

// export const handler = async (event) => {
//     try {
//         const body = event;

//         const {
//             campaignId,
//             email,
//             campaignName,
//             bot,
//             template,
//             timezone,
//             campaignType,
//             numbers,
//             fileUrl,
//             group,
//             runType,
//             scheduleDate,
//             scheduleTime,
//             expiryEnabled,
//             expiryDate,
//             expiryTime
//         } = body;

//         // -----------------------------
//         // 1. VALIDATION
//         // -----------------------------
//         if (!campaignId || !email) {
//             return response(400, "campaignId and email are required");
//         }

//         // -----------------------------
//         // 2. FETCH CAMPAIGN
//         // -----------------------------
//         const existing = await docClient.send(new GetCommand({
//             TableName: CAMPAIGN_TABLE,
//             Key: { id: campaignId }
//         }));

//         if (!existing.Item) {
//             return response(404, "Campaign not found");
//         }

//         const oldCampaign = existing.Item;

//         // Prevent update if completed
//         if (oldCampaign.status === "completed") {
//             return response(400, "Cannot update completed campaign");
//         }

//         // -----------------------------
//         // 3. CHECK USER
//         // -----------------------------
//         const userData = await docClient.send(new GetCommand({
//             TableName: USER_TABLE,
//             Key: { id: email }
//         }));

//         if (!userData.Item) {
//             return response(404, "User not found");
//         }

//         // -----------------------------
//         // 4. CHECK CREDIT
//         // -----------------------------
//         const creditData = await docClient.send(new GetCommand({
//             TableName: CREDIT_TABLE,
//             Key: { id: email }
//         }));

//         if (!creditData.Item || creditData.Item.total_balance <= 0) {
//             return response(400, "Insufficient credit");
//         }

//         let validNumbers = oldCampaign.numbers || [];

//         // =====================================================
//         // QUICK CAMPAIGN UPDATE
//         // =====================================================
//         if (campaignType === "quick" && numbers) {

//             let invalidNumbers = [];

//             validNumbers = numbers.map((num) => {
//                 const normalized = normalizeNumber(num);
//                 if (!normalized) invalidNumbers.push(num);
//                 return normalized;
//             }).filter(Boolean);

//             if (invalidNumbers.length > 0) {
//                 return response(400, {
//                     message: "Invalid numbers found",
//                     invalidNumbers
//                 });
//             }

//             validNumbers = [...new Set(validNumbers)];
//         }

//         // =====================================================
//         // BULK CAMPAIGN UPDATE
//         // =====================================================
//         if (campaignType === "bulk" && fileUrl) {

//             const csvPayload = {
//                 campaignName,
//                 message: template || "",
//                 bot,
//                 fileUrl
//             };

//             const csvResponse = await generateCSV(csvPayload);

//             if (csvResponse.statusCode && csvResponse.statusCode !== 200) {
//                 return csvResponse;
//             }

//             const { csvUrl, numbers: processedNumbers } = csvResponse;

//             validNumbers = processedNumbers;
//             body.fileUrl = csvUrl;
//         }

//         // -----------------------------
//         // 5. CREDIT CHECK
//         // -----------------------------
//         if (validNumbers.length > creditData.Item.total_balance) {
//             return response(400, "Not enough credits");
//         }

//         // -----------------------------
//         // 6. BUILD UPDATE EXPRESSION
//         // -----------------------------
//         let UpdateExpression = "SET ";
//         let ExpressionAttributeNames = {};
//         let ExpressionAttributeValues = {};

//         const fields = {
//             campaignName,
//             bot,
//             template,
//             timezone,
//             campaignType,
//             numbers: validNumbers,
//             group,
//             fileUrl: body.fileUrl,
//             runType,
//             scheduleDate,
//             scheduleTime,
//             expiryEnabled,
//             expiryDate,
//             expiryTime,
//             updatedAt: new Date().toISOString()
//         };

//         let index = 0;

//         for (let key in fields) {
//             if (fields[key] !== undefined) {
//                 index++;
//                 UpdateExpression += `#k${index} = :v${index}, `;
//                 ExpressionAttributeNames[`#k${index}`] = key;
//                 ExpressionAttributeValues[`:v${index}`] = fields[key];
//             }
//         }

//         UpdateExpression = UpdateExpression.slice(0, -2);

//         // -----------------------------
//         // 7. UPDATE DB
//         // -----------------------------
//         await docClient.send(new UpdateCommand({
//             TableName: CAMPAIGN_TABLE,
//             Key: { id: campaignId },
//             UpdateExpression,
//             ExpressionAttributeNames,
//             ExpressionAttributeValues
//         }));

//         // -----------------------------
//         // RESPONSE
//         // -----------------------------
//         return response(200, {
//             message: "Campaign updated successfully",
//             campaignId
//         });

//     } catch (error) {
//         console.error(error);
//         return response(500, error.message);
//     }
// };

// // -----------------------------
// // NUMBER VALIDATION (same as yours)
// // -----------------------------
// const normalizeNumber = (num) => {
//     if (!num) return null;

//     const original = num.toString().trim();

//     if (/[a-zA-Z]/.test(original)) return null;
//     if (original.includes("+")) return null;
//     if (!/^[\d\-\s]+$/.test(original)) return null;

//     let cleaned = original.replace(/[\s\-]/g, "");

//     if (cleaned.length === 12 && cleaned.startsWith("91")) {
//         cleaned = cleaned.slice(2);
//     }

//     if (!/^[6-9]\d{9}$/.test(cleaned)) return null;

//     return "91" + cleaned;
// };

// // -----------------------------
// const generateCSV = async (payload) => {
//     const command = new InvokeCommand({
//         FunctionName: "rcs_campaignToCsv",
//         InvocationType: "RequestResponse",
//         Payload: Buffer.from(JSON.stringify(payload))
//     });

//     const response = await lambdaClient.send(command);
//     const result = JSON.parse(new TextDecoder().decode(response.Payload));

//     if (result.statusCode && result.statusCode !== 200) {
//         return result;
//     }

//     return typeof result.body === "string"
//         ? JSON.parse(result.body)
//         : result;
// };

// // -----------------------------
// const response = (statusCode, body) => ({
//     statusCode,
//     body: JSON.stringify(body)
// });



















































































