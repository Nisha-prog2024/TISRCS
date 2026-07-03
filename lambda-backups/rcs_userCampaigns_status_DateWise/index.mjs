import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CAMPAIGN_TABLE = "rcs_campaign";

export const handler = async (event) => {
    try {
        const { email, status, startDate, endDate } = event;

        if (!email) {
            return response(400, "Email is required");
        }

        let items = [];

        // -----------------------------
        // CASE 1: STATUS FILTER (GSI)
        // -----------------------------
        if (status) {
            const params = {
                TableName: CAMPAIGN_TABLE,
                IndexName: "status-index", // ✅ GSI on status
                KeyConditionExpression: "#status = :statusVal",
                FilterExpression: "email = :emailVal",
                ExpressionAttributeNames: {
                    "#status": "status"
                },
                ExpressionAttributeValues: {
                    ":statusVal": status,
                    ":emailVal": email
                },
                ScanIndexForward: false
            };

            const result = await docClient.send(new QueryCommand(params));
            items = result.Items || [];
        }

        // -----------------------------
        // CASE 2: ONLY DATE FILTER
        // -----------------------------
        else if (startDate && endDate) {
            const params = {
                TableName: CAMPAIGN_TABLE,
                FilterExpression: "email = :emailVal AND #date BETWEEN :start AND :end",
                ExpressionAttributeNames: {
                    "#date": "date"
                },
                ExpressionAttributeValues: {
                    ":emailVal": email,
                    ":start": startDate,
                    ":end": endDate
                }
            };

            const result = await docClient.send(new ScanCommand(params));
            items = result.Items || [];
        }

        // -----------------------------
        // CASE 3: BOTH STATUS + DATE
        // -----------------------------
        if (status && startDate && endDate) {
            items = items.filter(item => {
                return item.date >= startDate && item.date <= endDate;
            });
        }

        // -----------------------------
        // RESPONSE
        // -----------------------------
        return response(200, {
            message: "Campaigns fetched successfully",
            count: items.length,
            campaigns: items
        });

    } catch (error) {
        console.error(error);
        return response(500, error.message);
    }
};

// -----------------------------
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body)
});