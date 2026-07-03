import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const CAMPAIGN_TABLE = "rcs_campaign";

export const handler = async (event) => {

    try {
        const body = event;
        const {campaignId} = body;

        // -----------------------------
        // 1. VALIDATION
        // -----------------------------
        if (!campaignId) {
            return response(400, "campaignId is required");
        }

        // -----------------------------
        // 2. FETCH CAMPAIGN
        // -----------------------------
        const result = await docClient.send(new GetCommand({
            TableName: CAMPAIGN_TABLE,
            Key: { id:campaignId}
        }));

        if (!result.Item) {
            return response(404, "Campaign not found");
        }

        const campaign = result.Item;

        // -----------------------------
        // 3. RESPONSE
        // -----------------------------
        return response(200, {
            message: "Campaign fetched successfully",
            campaign
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