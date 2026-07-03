import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    UpdateCommand,
    GetCommand,
    PutCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DynamoDB Config
// ======================

const client = new DynamoDBClient({
    region: "ap-south-1"
});

const docClient =
    DynamoDBDocumentClient.from(client);

// ======================
// Table Details
// ======================

const CAMPAIGN_TABLE =
    "rcs_campaign";

const REPORT_TABLE =
    "rcs_campaign_reports";

// ======================
// Allowed Status
// ======================

const allowedStatus = [
    "completed",
    "inprogress",
    "pending",
    
    "failed",
    
];

// ======================
// Response Helper
// ======================

const response = (
    statusCode,
    body
) => ({
    statusCode,

    headers: {
        "Content-Type":
            "application/json"
    },

    body: JSON.stringify(body)
});

// ======================
// Lambda Handler
// ======================

export const handler = async (event) => {

    try {

        // ======================
        // Parse Body
        // ======================

        const body =
            typeof event.body === "string"
                ? JSON.parse(event.body)
                : event;

        const {
            campaignId,
            status,

            numbers,

            sent,
            delivered,
            failed,

            
            

        } = body;

        // ======================
        // Validation
        // ======================

        // if (!campaignId || !status|| !numbers|| !sent|| !delivered|| !failed) {

        //     return response(400, {
        //         message:
        //             "campaignId  status numbers sent delivered failed  are required"
        //     });
        // }
        if (
            !campaignId ||
            !status ||
            numbers == null ||
            sent == null ||
            delivered == null ||
            failed == null
        ) {
            return response(400, {
                message: "campaignId, status, numbers, sent, delivered and failed are required"
            });
        }

        // ======================
        // Validate Status
        // ======================

        if (
            !allowedStatus.includes(status)
        ) {

            return response(400, {
                message:
                    "Invalid status value",

                allowedStatus
            });
        }

        // ======================
        // Check Campaign Exists
        // ======================

        const existingCampaign =
            await docClient.send(
                new GetCommand({
                    TableName:
                        CAMPAIGN_TABLE,

                    Key: {
                        id: campaignId
                    }
                })
            );

        if (!existingCampaign.Item) {

            return response(404, {
                message:
                    "Campaign not found"
            });
        }

        const campaign =
            existingCampaign.Item;

        // ======================
        // Update Campaign Status
        // ======================

        await docClient.send(
            new UpdateCommand({

                TableName:
                    CAMPAIGN_TABLE,

                Key: {
                    id: campaignId
                },

                UpdateExpression:
                    "SET #status = :status, updatedAt = :updatedAt",

                ExpressionAttributeNames: {
                    "#status":
                        "status"
                },

                ExpressionAttributeValues: {

                    ":status":
                        status,

                    ":updatedAt":
                        new Date().toISOString()
                }
            })
        );

        // ======================
        // Save Report
        // ======================

        if (
            status === "completed"
        ) {
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

const reportDate =
    istDate
        .toISOString()
        .split("T")[0];

const reportTime =
    istDate.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        }
    );
            const reportId =
                `rpt_${Date.now()}`;

            await docClient.send(
                new PutCommand({

                    TableName:
                        REPORT_TABLE,

                    Item: {

                        id:
                            reportId,

                        campaignId,

                        email:
                            campaign.email || null,

                        campaignName:
                            campaign.campaignName || null,

                        campaignForm:
                            campaign.campaignForm || null,

                        bot:
                            campaign.bot || null,

                        numbers:
                            numbers || [],

                            sent: Number(sent ?? 0),

                            delivered: Number(delivered ?? 0),
                            
                            failed: Number(failed ?? 0),

                        reportDate,

                        reportTime,

                        status,

                        createdAt:
                            new Date().toISOString(),

                        tstamp:
                            Date.now()
                    }
                })
            );
        }

        // ======================
        // Success Response
        // ======================

        return response(200, {

            message:
                "Campaign status updated successfully",

            campaignId,

            updatedStatus:
                status
        });

    } catch (error) {

        console.error(
            "Update Campaign Status Error:",
            error
        );

        return response(500, {

            message:
                "Internal server error",

            error:
                error.message
        });
    }
};



















































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// import {
//     DynamoDBDocumentClient,
//     UpdateCommand,
//     GetCommand,
//     PutCommand
// } from "@aws-sdk/lib-dynamodb";

// // ======================
// // DynamoDB Config
// // ======================

// const client = new DynamoDBClient({
//     region: "ap-south-1"
// });

// const docClient =
//     DynamoDBDocumentClient.from(client);

// // ======================
// // Table Details
// // ======================

// const CAMPAIGN_TABLE = "rcs_campaign";
// const REPORT_TABLE = "rcs_campaign_reports";

// // ======================
// // Allowed Status
// // ======================

// const allowedStatus = [
//     "completed",
//     "inprogress",
//     "pending",
//     "cancelled",
//     "failed",
//     "reinitialized"
// ];

// // ======================
// // Response Helper
// // ======================

// const response = (
//     statusCode,
//     body
// ) => ({
//     statusCode,

//     headers: {
//         "Content-Type":
//             "application/json"
//     },

//     body: JSON.stringify(body)
// });

// // ======================
// // Lambda Handler
// // ======================

// export const handler = async (event) => {

//     try {

//         // ======================
//         // Parse Body
//         // ======================

//         const body =
//             typeof event.body === "string"
//                 ? JSON.parse(event.body)
//                 : event;

//                 const {
//                     campaignId,
//                     status,
//                     email,
//                     numbers,
//                     campaignName,
//                     campaignForm,
//                     bot,
                
//                     sent,
//                     delivered,
//                     failed,
                
//                     date,
//                     time
                
//                 } = body;
//         // ======================
//         // Validation
//         // ======================

//         if (!campaignId || !status ||!email) {
//             return response(400, {
//                 message:
//                     "campaignId email and status are required"
//             });
//         }

//         // ======================
//         // Validate Status
//         // ======================

//         if (!allowedStatus.includes(status)) {
//             return response(400, {
//                 message:
//                     "Invalid status value",
//                 allowedStatus
//             });
//         }

//         // ======================
//         // Check Campaign Exists
//         // ======================

//         const existingCampaign =
//             await docClient.send(
//                 new GetCommand({
//                     TableName: CAMPAIGN_TABLE,
//                     Key: {
//                         id: campaignId
//                     }
//                 })
//             );

//         if (!existingCampaign.Item) {
//             return response(404, {
//                 message:
//                     "Campaign not found"
//             });
//         }

//         // ======================
//         // Update Status
//         // ======================

//         await docClient.send(
//             new UpdateCommand({
//                 TableName: CAMPAIGN_TABLE,

//                 Key: {
//                     id: campaignId
//                 },

//                 UpdateExpression:
//                     "SET #status = :status, updatedAt = :updatedAt",

//                 ExpressionAttributeNames: {
//                     "#status": "status"
//                 },

//                 ExpressionAttributeValues: {
//                     ":status": status,
//                     ":updatedAt":
//                         new Date().toISOString()
//                 },

//                 ReturnValues:
//                     "ALL_NEW"
//             })
//         );
// // ======================
// // SAVE REPORT WHEN COMPLETED
// // ======================

// if (status === "completed") {

//     const reportId =
//         `rpt_${Date.now()}`;

//     await docClient.send(
//         new PutCommand({

//             TableName:
//                 REPORT_TABLE,

//             Item: {

//                 id: reportId,
//                 email,
//                 campaignId,

//                 numbers:
//                     numbers || [],

//                 campaignName:
//                     campaignName || null,

//                 campaignForm:
//                     campaignForm || null,

//                 bot:
//                     bot || null,

//                 sent:
//                     Number(sent || 0),

//                 delivered:
//                     Number(delivered || 0),

//                 failed:
//                     Number(failed || 0),

//                     reportDate:
//                     date || null,

//                     reportTime:
//                     time || null,

//                 status,

//                 createdAt:
//                     new Date().toISOString(),

//                 tstamp:
//                     Date.now()
//             }
//         })
//     );
// }
//         // ======================
//         // Success Response
//         // ======================

//         return response(200, {
//             message:
//                 "Campaign status updated successfully",

//             campaignId,
//             updatedStatus: status
//         });

//     } catch (error) {

//         console.error(
//             "Update Campaign Status Error:",
//             error
//         );

//         return response(500, {
//             message:
//                 "Internal server error",

//             error:
//                 error.message
//         });
//     }
// };