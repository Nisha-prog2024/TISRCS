import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
    region: "ap-south-1"
});

const docClient =
    DynamoDBDocumentClient.from(client);

const TEMPLATE_TABLE = "rcs_templates";

export const handler = async (event) => {
    try {

        const { email, botName } = event;

        // -----------------------------
        // 1. VALIDATION
        // -----------------------------
        if (!email || !botName) {
            return response(400, {
                message: "email and botName are required"
            });
        }

        // -----------------------------
        // 2. QUERY USING status-index
        // Fetch only approved templates
        // -----------------------------
        const params = {
            TableName: TEMPLATE_TABLE,
            IndexName: "status-index",
            KeyConditionExpression:
                "#status = :statusVal",

            FilterExpression:
                "email = :emailVal AND botName = :botVal",

            ExpressionAttributeNames: {
                "#status": "status"
            },

            ExpressionAttributeValues: {
                ":statusVal": "active",
                ":emailVal": email,
                ":botVal": botName
            }
        };

        const result = await docClient.send(
            new QueryCommand(params)
        );

        // -----------------------------
        // 3. NO ACTIVE TEMPLATE FOUND
        // -----------------------------
        if (
            !result.Items ||
            result.Items.length === 0
        ) {
            return response(404, {
                message:
                    "No active template found in this bot",
                count: 0,
                templates: []
            });
        }

        // -----------------------------
        // 4. SUCCESS RESPONSE
        // -----------------------------
        return response(200, {
            message:
                "Active templates fetched successfully",
            count: result.Items.length,
            templates: result.Items
        });

    } catch (error) {

        console.error(
            "Fetch Templates Error:",
            error
        );

        return response(500, {
            message: "Internal server error",
            error: error.message
        });
    }
};

// -----------------------------
// Response Helper
// -----------------------------
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body)
});

































































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);

// const TEMPLATE_TABLE = "rcs_templates";

// export const handler = async (event) => {
//     try {
//         const { email, botName } = event;

//         // -----------------------------
//         // 1. VALIDATION
//         // -----------------------------
//         if (!email || !botName) {
//             return response(400, "email and botName are required");
//         }

//         // -----------------------------
//         // 2. QUERY USING email-index
//         // -----------------------------
//         const params = {
//             TableName: TEMPLATE_TABLE,
//             IndexName: "email-index", // ✅ GSI
//             KeyConditionExpression: "email = :emailVal",
//             FilterExpression: "botName = :botVal",
//             ExpressionAttributeValues: {
//                 ":emailVal": email,
//                 ":botVal": botName
//             }
//         };

//         const result = await docClient.send(new QueryCommand(params));

//         // -----------------------------
//         // 3. RESPONSE
//         // -----------------------------
//         return response(200, {
//             message: "Templates fetched successfully",
//             count: result.Count,
//             templates: result.Items || []
//         });

//     } catch (error) {
//         console.error(error);
//         return response(500, error.message);
//     }
// };


// // -----------------------------
// const response = (statusCode, body) => ({
//     statusCode,
//     body: JSON.stringify(body)
// });