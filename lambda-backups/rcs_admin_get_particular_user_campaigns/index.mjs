import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CAMPAIGN_TABLE = "rcs_campaign";

export const handler = async (event) => {
    try {
        const email = event.email;

        // -----------------------------
        // 1. VALIDATION
        // -----------------------------
        if (!email) {
            return response(400, "Email is required");
        }

        // -----------------------------
        // 2. QUERY USING GSI
        // -----------------------------
        const params = {
            TableName: CAMPAIGN_TABLE,
            IndexName: "email-index", 
            KeyConditionExpression: "email = :email",
            ExpressionAttributeValues: {
                ":email": email
            },
            ScanIndexForward: false // latest first
        };

        const result = await docClient.send(new QueryCommand(params));

        // -----------------------------
        // 3. RESPONSE
        // -----------------------------
        return response(200, {
            message: "Campaigns fetched successfully",
            count: result.Count,
            campaigns: result.Items || []
        });

    } catch (error) {
        console.error(error);
        return response(500, error.message);
    }
};

// -----------------------------
// RESPONSE HELPER
// -----------------------------
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body)
});