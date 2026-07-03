import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    UpdateCommand
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

const USER_TABLE =
    "rcs_admin_and_users";

const CAMPAIGN_TABLE =
    "rcs_campaign";

const BLACKLIST_TABLE =
    "rcs_user_blacklist_numbers";
    const TEMPLATE_TABLE =
    "rcs_templates";
const CAMPAIGN_TRANSACTION_TABLE =
    "rcs_campaign_transactions";
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
         
            email,
            username,

            campaignName,

            bot,
            message,

            campaignForm, // text / rich
            templateId,
            template,

            timezone,

            campaignType, // quick / bulk

            numbers,

            fileUrl,

            group,

            runType, // now / later

            scheduleDate,
            scheduleTime,
            expiryEnabled,
           // expiryDate,
           // expiryTime

        } = body;

        // =================================================
        // BASIC VALIDATION
        // =================================================

        if (
            !email ||
            !campaignName ||
            !bot ||
            !campaignForm ||
            !timezone ||
            !campaignType ||
            !runType
        ) {

            return response(
                400,
                "Missing required fields"
            );
        }

        // =================================================
        // VALIDATE CAMPAIGN FORM
        // =================================================

        if (
            campaignForm !== "text" &&
            campaignForm !== "rich"
        ) {

            return response(
                400,
                "campaignForm must be text or rich"
            );
        }

        
        // =================================================
        // TEXT CAMPAIGN VALIDATION
        // =================================================

        if (
            campaignForm === "text" &&
            template
        ) {

            return response(
                400,
                "Template not allowed for text campaign"
            );
        }

        // =================================================
        // CHECK USER EXISTS
        // =================================================

        const userData =
            await docClient.send(
                new GetCommand({
                    TableName: USER_TABLE,
                    Key: {
                        id: email
                    }
                })
            );

        if (!userData.Item) {

            return response(
                404,
                "User not found"
            );
        }
      


        // =================================================
// FETCH TEMPLATE DETAILS
// =================================================

let templateDetails = null;

if (templateId) {

    const templateData =
        await docClient.send(
            new GetCommand({
                TableName: TEMPLATE_TABLE,
                Key: {
                    id: templateId
                }
            })
        );

    if (!templateData.Item) {

        return response(
            404,
            "Template not found"
        );
    }

    templateDetails =
        templateData.Item;
}
        // =================================================
        // FINAL VALID NUMBERS
        // =================================================

        let validNumbers = [];
        let blacklistedNumbers = [];

        // =================================================
        // QUICK CAMPAIGN
        // =================================================

        if (
            campaignType ===
            "quick"
        ) {

            // =============================================
            // REQUIRE NUMBERS OR GROUP
            // =============================================

            if (
                (!numbers ||
                    numbers.length === 0) &&
                !group
            ) {

                return response(
                    400,
                    "Provide numbers or group"
                );
            }

            let invalidNumbers = [];

            // =============================================
            // VALIDATE NUMBERS
            // =============================================

            if (
                numbers &&
                numbers.length > 0
            ) {

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
                // STOP IF INVALID FOUND
                // =========================================

                if (
                    invalidNumbers.length > 0
                ) {

                    return response(400, {

                        message:
                            "Invalid phone numbers found,campaign can't be created",

                        invalidNumbers
                    });
                }

                // =========================================
                // REMOVE DUPLICATES
                // =========================================

                validNumbers =
                    [...new Set(validNumbers)];

               
                const blacklistResult =
    await removeBlacklistedNumbers(
        validNumbers
    );

validNumbers =
    blacklistResult.validNumbers;

blacklistedNumbers =
    blacklistResult.blacklistedNumbers;

                // =========================================
                // ALL NUMBERS BLACKLISTED
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
            campaignType ===
            "bulk"
        ) {

            // =============================================
            // FILE URL REQUIRED
            // =============================================

            if (!fileUrl) {

                return response(
                    400,
                    "fileUrl is required"
                );
            }

            // =============================================
            // CALL CSV VALIDATION LAMBDA
            // =============================================

            const csvPayload = {

                fileUrl
            };

            const csvResponse =
                await validateCSVNumbers(
                    csvPayload
                );

            // =============================================
            // CSV VALIDATION FAILED
            // =============================================

            if (
                csvResponse.statusCode &&
                csvResponse.statusCode !== 200
            ) {

                return csvResponse;
            }

            // =============================================
            // GET VALIDATED NUMBERS
            // =============================================

            const {
                numbers:
                    processedNumbers
            } = csvResponse;

            // =============================================
            // REMOVE DUPLICATES
            // =============================================

            validNumbers =
                [...new Set(processedNumbers)];

            
           

            const blacklistResult =
    await removeBlacklistedNumbers(
        validNumbers
    );

validNumbers =
    blacklistResult.validNumbers;

blacklistedNumbers =
    blacklistResult.blacklistedNumbers;

            // =============================================
            // ALL BLACKLISTED
            // =============================================

            if (
                validNumbers.length === 0
            ) {

                return response(
                    400,
                    "All numbers are blacklisted"
                );
            }
        }

        // =================================================
        // INVALID CAMPAIGN TYPE
        // =================================================

        else {

            return response(
                400,
                "Invalid campaignType"
            );
        }

        const campaignId =
            `cmp_${Date.now()}`;

        // =================================================
        // IST DATE/TIME
        // =================================================

        const now = new Date();

        const istDate = new Date(
            now.toLocaleString(
                "en-US",
                {
                    timeZone:
                        "Asia/Kolkata"
                }
            )
        );

        const date =
            istDate
                .toISOString()
                .split("T")[0];

        const time =
            istDate.toLocaleTimeString(
                "en-IN",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                }
            );

        const tstamp = Date.now();

        const year =
            istDate.getFullYear();

        // =================================================
        // CAMPAIGN OBJECT
        // =================================================

        const campaignItem = {

            id: campaignId,

            campaignName,

            bot,

            campaignForm,
            message,

            template:
                campaignForm === "rich"
                    ? template
                    : null,
            templateId: templateId || null,

            templateDetails,
            timezone,

            campaignType,

            numbers: validNumbers,

            totalValidNumbers:
                validNumbers.length,

            group:
                group || null,

            // =============================================
            // ORIGINAL FILE URL ONLY
            // =============================================

            fileUrl:
                fileUrl || null,

            runType,

            scheduleDate:
                scheduleDate || null,

            scheduleTime:
                scheduleTime || null,
           expiryEnabled: expiryEnabled || false,

            // expiryDate:
            //     expiryDate || null,

            // expiryTime:
            //     expiryTime || null,

            username:username?.toLowerCase() || "",

            email,

            status: "pending",

            date,

            time,

            tstamp,

            year,

            createdAt:
                new Date().toISOString()
        };
// =================================================
// BILLING LOGIC
// =================================================

const walletBalance =
    Number(userData.Item.walletBalance || 0);

const totalNumbers =
    validNumbers.length;

let deductionAmount = 0;

let billingDetails = {};

// ================================================
// TEXT CAMPAIGN
// ================================================

if (campaignForm === "text") {

    const smsPrice =
        Number(userData.Item.smsPrice || 0);

    deductionAmount =
        totalNumbers * smsPrice;

    billingDetails = {

        smsDeductionType:
            userData.Item.smsDeductionType || "sent",

        smsPrice,

        totalNumbers,

        amount:
            deductionAmount
    };
}

// ================================================
// RICH CAMPAIGN
// ================================================

if (campaignForm === "rich") {

    const rcsPrice =
        Number(userData.Item.rcsPrice || 0);

    deductionAmount =
        totalNumbers * rcsPrice;

    billingDetails = {

        rcsDeductionType:
            userData.Item.rcsDeductionType || "sent",

        rcsPrice,

        totalNumbers,

        amount:
            deductionAmount
    };
}

// ================================================
// CHECK BALANCE
// ================================================

if (
    walletBalance <
    deductionAmount
) {

    return response(
        400,
        `Insufficient wallet balance. Required ₹${deductionAmount} Available ₹${walletBalance}`
    );
}

const updatedWalletBalance =
    walletBalance -
    deductionAmount;

// ================================================
// UPDATE WALLET
// ================================================

await docClient.send(
    new UpdateCommand({

        TableName:
            USER_TABLE,

        Key: {
            id: email
        },

        UpdateExpression:
            "SET walletBalance = :walletBalance",

        ExpressionAttributeValues: {

            ":walletBalance":
                updatedWalletBalance
        }
    })
);
        // =================================================
        // SAVE CAMPAIGN
        // =================================================

        await docClient.send(
            new PutCommand({
                TableName:
                    CAMPAIGN_TABLE,
                Item: campaignItem
            })
        );

       // =================================================
// SAVE TRANSACTION
// =================================================

await docClient.send(
    new PutCommand({

        TableName:
            CAMPAIGN_TRANSACTION_TABLE,

        Item: {

            id:
                `txn_${Date.now()}`,

            campaignId,

            email,

            username:
                username?.toLowerCase() || "",

            campaignForm,

            totalNumbers,

            amountDeducted:
                deductionAmount,

            openingBalance:
                walletBalance,

            closingBalance:
                updatedWalletBalance,

            billingDetails,

            status:
                "success",

            date,

            time,

            year,

            tstamp,

            createdAt:
                new Date().toISOString()
        }
    })
);
        return response(200, {

            message:
                blacklistedNumbers.length > 0
                    ? "Campaign created successfully. Some blacklisted numbers were excluded."
                    : "Campaign created successfully",
        
            campaignId,
        
            totalValidNumbers:
                validNumbers.length,
        
            excludedBlacklistedCount:
                blacklistedNumbers.length,
        
            excludedBlacklistedNumbers:
                blacklistedNumbers,
                billing: {

                    campaignForm,
            
                    amountDeducted:
                        deductionAmount,
            
                    openingBalance:
                        walletBalance,
            
                    closingBalance:
                        updatedWalletBalance,
            
                    ...billingDetails
                }
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

    let cleaned =
        num.toString().replace(/\D/g, "");

    // remove 91 only if actual country code
    if (
        cleaned.length === 12 &&
        cleaned.startsWith("91")
    ) {

        cleaned =
            cleaned.slice(2);
    }

    // validate indian mobile
    if (
        /^[6-9]\d{9}$/.test(cleaned)
    ) {

        return cleaned;
    }

    return null;
};
// =====================================================
// REMOVE BLACKLISTED NUMBERS
// =====================================================

const removeBlacklistedNumbers =
    async (numbers) => {

        const validNumbers = [];

        const blacklistedNumbers = [];

        for (const number of numbers) {

            // =========================================
            // CHECK NUMBER IN GSI
            // number-index
            // =========================================

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
            // NUMBER FOUND
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
        // RETURN ERROR
        // =============================================

        if (
            result.statusCode &&
            result.statusCode !== 200
        ) {

            return result;
        }

        // =============================================
        // RETURN ONLY VALIDATED NUMBERS
        // =============================================

        const body =
            typeof result.body === "string"
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
//     PutCommand,
//     QueryCommand
// } from "@aws-sdk/lib-dynamodb";

// import {
//     LambdaClient,
//     InvokeCommand
// } from "@aws-sdk/client-lambda";

// // =====================================================
// // AWS CONFIG
// // =====================================================

// const client = new DynamoDBClient({
//     region: "ap-south-1"
// });

// const docClient =
//     DynamoDBDocumentClient.from(client);

// const lambdaClient =
//     new LambdaClient({
//         region: "ap-south-1"
//     });

// // =====================================================
// // TABLES
// // =====================================================

// const USER_TABLE =
//     "rcs_admin_and_users";

// const CAMPAIGN_TABLE =
//     "rcs_campaign";

// const BLACKLIST_TABLE =
//     "rcs_user_blacklist_numbers";
//     const TEMPLATE_TABLE =
//     "rcs_templates";
// // =====================================================
// // MAIN HANDLER
// // =====================================================

// export const handler = async (event) => {

//     try {

//         // =================================================
//         // REQUEST BODY
//         // =================================================

//         const body = event;

//         const {
         
//             email,
//             username,

//             campaignName,

//             bot,

//             campaignForm, // text / rich
//             templateId,
//             template,

//             timezone,

//             campaignType, // quick / bulk

//             numbers,

//             fileUrl,

//             group,

//             runType, // now / later

//             scheduleDate,
//             scheduleTime,
//             expiryEnabled,
//            // expiryDate,
//            // expiryTime

//         } = body;

//         // =================================================
//         // BASIC VALIDATION
//         // =================================================

//         if (
//             !email ||
//             !campaignName ||
//             !bot ||
//             !campaignForm ||
//             !timezone ||
//             !campaignType ||
//             !runType
//         ) {

//             return response(
//                 400,
//                 "Missing required fields"
//             );
//         }

//         // =================================================
//         // VALIDATE CAMPAIGN FORM
//         // =================================================

//         if (
//             campaignForm !== "text" &&
//             campaignForm !== "rich"
//         ) {

//             return response(
//                 400,
//                 "campaignForm must be text or rich"
//             );
//         }

        
//         // =================================================
//         // TEXT CAMPAIGN VALIDATION
//         // =================================================

//         if (
//             campaignForm === "text" &&
//             template
//         ) {

//             return response(
//                 400,
//                 "Template not allowed for text campaign"
//             );
//         }

//         // =================================================
//         // CHECK USER EXISTS
//         // =================================================

//         const userData =
//             await docClient.send(
//                 new GetCommand({
//                     TableName: USER_TABLE,
//                     Key: {
//                         id: email
//                     }
//                 })
//             );

//         if (!userData.Item) {

//             return response(
//                 404,
//                 "User not found"
//             );
//         }
      


//         // =================================================
// // FETCH TEMPLATE DETAILS
// // =================================================

// let templateDetails = null;

// if (templateId) {

//     const templateData =
//         await docClient.send(
//             new GetCommand({
//                 TableName: TEMPLATE_TABLE,
//                 Key: {
//                     id: templateId
//                 }
//             })
//         );

//     if (!templateData.Item) {

//         return response(
//             404,
//             "Template not found"
//         );
//     }

//     templateDetails =
//         templateData.Item;
// }
//         // =================================================
//         // FINAL VALID NUMBERS
//         // =================================================

//         let validNumbers = [];
//         let blacklistedNumbers = [];

//         // =================================================
//         // QUICK CAMPAIGN
//         // =================================================

//         if (
//             campaignType ===
//             "quick"
//         ) {

//             // =============================================
//             // REQUIRE NUMBERS OR GROUP
//             // =============================================

//             if (
//                 (!numbers ||
//                     numbers.length === 0) &&
//                 !group
//             ) {

//                 return response(
//                     400,
//                     "Provide numbers or group"
//                 );
//             }

//             let invalidNumbers = [];

//             // =============================================
//             // VALIDATE NUMBERS
//             // =============================================

//             if (
//                 numbers &&
//                 numbers.length > 0
//             ) {

//                 validNumbers = numbers
//                     .map((num) => {

//                         const normalized =
//                             normalizeNumber(num);

//                         if (!normalized) {

//                             invalidNumbers.push(num);
//                         }

//                         return normalized;
//                     })
//                     .filter(Boolean);

            

//                 // =========================================
//                 // STOP IF INVALID FOUND
//                 // =========================================

//                 if (
//                     invalidNumbers.length > 0
//                 ) {

//                     return response(400, {

//                         message:
//                             "Invalid phone numbers found,campaign can't be created",

//                         invalidNumbers
//                     });
//                 }

//                 // =========================================
//                 // REMOVE DUPLICATES
//                 // =========================================

//                 validNumbers =
//                     [...new Set(validNumbers)];

//                 // =========================================
//                 // REMOVE BLACKLISTED NUMBERS
//                 // =========================================

//                 // const blacklistResult =
//                 //     await removeBlacklistedNumbers(
//                 //         validNumbers
//                 //     );

//                 // validNumbers =
//                 //     blacklistResult.validNumbers;
//                 const blacklistResult =
//     await removeBlacklistedNumbers(
//         validNumbers
//     );

// validNumbers =
//     blacklistResult.validNumbers;

// blacklistedNumbers =
//     blacklistResult.blacklistedNumbers;

//                 // =========================================
//                 // ALL NUMBERS BLACKLISTED
//                 // =========================================

//                 if (
//                     validNumbers.length === 0
//                 ) {

//                     return response(
//                         400,
//                         "All numbers are blacklisted"
//                     );
//                 }
//             }
//         }

//         // =================================================
//         // BULK CAMPAIGN
//         // =================================================

//         else if (
//             campaignType ===
//             "bulk"
//         ) {

//             // =============================================
//             // FILE URL REQUIRED
//             // =============================================

//             if (!fileUrl) {

//                 return response(
//                     400,
//                     "fileUrl is required"
//                 );
//             }

//             // =============================================
//             // CALL CSV VALIDATION LAMBDA
//             // =============================================

//             const csvPayload = {

//                 fileUrl
//             };

//             const csvResponse =
//                 await validateCSVNumbers(
//                     csvPayload
//                 );

//             // =============================================
//             // CSV VALIDATION FAILED
//             // =============================================

//             if (
//                 csvResponse.statusCode &&
//                 csvResponse.statusCode !== 200
//             ) {

//                 return csvResponse;
//             }

//             // =============================================
//             // GET VALIDATED NUMBERS
//             // =============================================

//             const {
//                 numbers:
//                     processedNumbers
//             } = csvResponse;

//             // =============================================
//             // REMOVE DUPLICATES
//             // =============================================

//             validNumbers =
//                 [...new Set(processedNumbers)];

//             // =============================================
//             // REMOVE BLACKLISTED NUMBERS
//             // =============================================

//             // const blacklistResult =
//             //     await removeBlacklistedNumbers(
//             //         validNumbers
//             //     );

//             // validNumbers =
//             //     blacklistResult.validNumbers;

//             const blacklistResult =
//     await removeBlacklistedNumbers(
//         validNumbers
//     );

// validNumbers =
//     blacklistResult.validNumbers;

// blacklistedNumbers =
//     blacklistResult.blacklistedNumbers;

//             // =============================================
//             // ALL BLACKLISTED
//             // =============================================

//             if (
//                 validNumbers.length === 0
//             ) {

//                 return response(
//                     400,
//                     "All numbers are blacklisted"
//                 );
//             }
//         }

//         // =================================================
//         // INVALID CAMPAIGN TYPE
//         // =================================================

//         else {

//             return response(
//                 400,
//                 "Invalid campaignType"
//             );
//         }

//         // =================================================
//         // RUN TYPE VALIDATION
//         // =================================================

//         // =================================================
//         // RUN NOW
//         // =================================================

//         // if (runType === "now") {

//         //     if (
//         //         !expiryDate 
//         //     ) {

//         //         return response(
//         //             400,
//         //             "expiryDate  required"
//         //         );
//         //     }
//         // }

//         // =================================================
//         // RUN LATER
//         // =================================================

//         // else if (
//         //     runType === "later"
//         // ) {

//         //     if (
//         //         !scheduleDate ||
//         //         !scheduleTime
//         //     ) {

//         //         return response(
//         //             400,
//         //             "scheduleDate and scheduleTime required"
//         //         );
//         //     }

//         //     if (
//         //         !expiryDate
//         //     ) {

//         //         return response(
//         //             400,
//         //             "expiryDate  required"
//         //         );
//         //     }
//         // }

//         // =================================================
//         // INVALID RUN TYPE
//         // =================================================

//         // else {

//         //     return response(
//         //         400,
//         //         "Invalid runType"
//         //     );
//         // }

//         // =================================================
//         // GENERATE CAMPAIGN ID
//         // =================================================

//         const campaignId =
//             `cmp_${Date.now()}`;

//         // =================================================
//         // IST DATE/TIME
//         // =================================================

//         const now = new Date();

//         const istDate = new Date(
//             now.toLocaleString(
//                 "en-US",
//                 {
//                     timeZone:
//                         "Asia/Kolkata"
//                 }
//             )
//         );

//         const date =
//             istDate
//                 .toISOString()
//                 .split("T")[0];

//         const time =
//             istDate.toLocaleTimeString(
//                 "en-IN",
//                 {
//                     hour: "2-digit",
//                     minute: "2-digit",
//                     second: "2-digit",
//                     hour12: true
//                 }
//             );

//         const tstamp = Date.now();

//         const year =
//             istDate.getFullYear();

//         // =================================================
//         // CAMPAIGN OBJECT
//         // =================================================

//         const campaignItem = {

//             id: campaignId,

//             campaignName,

//             bot,

//             campaignForm,

//             template:
//                 campaignForm === "rich"
//                     ? template
//                     : null,
//             templateId: templateId || null,

//             templateDetails,
//             timezone,

//             campaignType,

//             numbers: validNumbers,

//             totalValidNumbers:
//                 validNumbers.length,

//             group:
//                 group || null,

//             // =============================================
//             // ORIGINAL FILE URL ONLY
//             // =============================================

//             fileUrl:
//                 fileUrl || null,

//             runType,

//             scheduleDate:
//                 scheduleDate || null,

//             scheduleTime:
//                 scheduleTime || null,
//            expiryEnabled: expiryEnabled || false,

//             // expiryDate:
//             //     expiryDate || null,

//             // expiryTime:
//             //     expiryTime || null,

//             username:username?.toLowerCase() || "",

//             email,

//             status: "pending",

//             date,

//             time,

//             tstamp,

//             year,

//             createdAt:
//                 new Date().toISOString()
//         };

//         // =================================================
//         // SAVE CAMPAIGN
//         // =================================================

//         await docClient.send(
//             new PutCommand({
//                 TableName:
//                     CAMPAIGN_TABLE,
//                 Item: campaignItem
//             })
//         );

//         // =================================================
//         // SUCCESS RESPONSE
//         // =================================================

//         // return response(200, {

//         //     message:
//         //         "Campaign created successfully",

//         //     campaignId,

//         //     totalValidNumbers:
//         //         validNumbers.length
//         // });
//         return response(200, {

//             message:
//                 blacklistedNumbers.length > 0
//                     ? "Campaign created successfully. Some blacklisted numbers were excluded."
//                     : "Campaign created successfully",
        
//             campaignId,
        
//             totalValidNumbers:
//                 validNumbers.length,
        
//             excludedBlacklistedCount:
//                 blacklistedNumbers.length,
        
//             excludedBlacklistedNumbers:
//                 blacklistedNumbers
//         });

//     } catch (error) {

//         console.error(error);

//         return response(
//             500,
//             error.message
//         );
//     }
// };

// // =====================================================
// // MOBILE NUMBER VALIDATION
// // =====================================================

// const normalizeNumber = (num) => {

//     if (!num) return null;

//     let cleaned =
//         num.toString().replace(/\D/g, "");

//     // remove 91 only if actual country code
//     if (
//         cleaned.length === 12 &&
//         cleaned.startsWith("91")
//     ) {

//         cleaned =
//             cleaned.slice(2);
//     }

//     // validate indian mobile
//     if (
//         /^[6-9]\d{9}$/.test(cleaned)
//     ) {

//         return cleaned;
//     }

//     return null;
// };
// // =====================================================
// // REMOVE BLACKLISTED NUMBERS
// // =====================================================

// const removeBlacklistedNumbers =
//     async (numbers) => {

//         const validNumbers = [];

//         const blacklistedNumbers = [];

//         for (const number of numbers) {

//             // =========================================
//             // CHECK NUMBER IN GSI
//             // number-index
//             // =========================================

//             const blacklistData =
//                 await docClient.send(
//                     new QueryCommand({

//                         TableName:
//                             BLACKLIST_TABLE,

//                         IndexName:
//                             "number-index",

//                         KeyConditionExpression:
//                             "#number = :number",

//                         ExpressionAttributeNames: {
//                             "#number":
//                                 "number"
//                         },

//                         ExpressionAttributeValues: {
//                             ":number":
//                                 number
//                         }
//                     })
//                 );

//             // =========================================
//             // NUMBER FOUND
//             // =========================================

//             if (
//                 blacklistData.Items &&
//                 blacklistData.Items.length > 0
//             ) {

//                 blacklistedNumbers.push(
//                     number
//                 );

//             } else {

//                 validNumbers.push(
//                     number
//                 );
//             }
//         }

//         return {
//             validNumbers,
//             blacklistedNumbers
//         };
//     };

// // =====================================================
// // CSV VALIDATION LAMBDA
// // =====================================================

// const validateCSVNumbers =
//     async (payload) => {

//         const command =
//             new InvokeCommand({

//                 FunctionName:
//                     "rcs_campaignToCsv",

//                 InvocationType:
//                     "RequestResponse",

//                 Payload: Buffer.from(
//                     JSON.stringify(payload)
//                 )
//             });

//         const response =
//             await lambdaClient.send(
//                 command
//             );

//         const result = JSON.parse(
//             new TextDecoder().decode(
//                 response.Payload
//             )
//         );

//         // =============================================
//         // RETURN ERROR
//         // =============================================

//         if (
//             result.statusCode &&
//             result.statusCode !== 200
//         ) {

//             return result;
//         }

//         // =============================================
//         // RETURN ONLY VALIDATED NUMBERS
//         // =============================================

//         const body =
//             typeof result.body === "string"
//                 ? JSON.parse(result.body)
//                 : result;

//         return {
//             statusCode: 200,
//             numbers:
//                 body.numbers || []
//         };
//     };

// // =====================================================
// // RESPONSE HELPER
// // =====================================================

// const response = (
//     statusCode,
//     body
// ) => ({

//     statusCode,

//     body: JSON.stringify(body)
// });





































