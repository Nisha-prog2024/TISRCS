import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    GetCommand,
    DeleteCommand
} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const s3 = new S3Client({ region: "ap-south-1" });

const CAMPAIGN_TABLE = "rcs_campaign";
const BUCKET_NAME = "rcs-main"; 

export const handler = async (event) => {
    try {
        const body = event;

        const { campaignId, email } = body;

        if (!campaignId || !email) {
            return response(400, "campaignId and email are required");
        }

        // -----------------------------
        // 1. FETCH CAMPAIGN
        // -----------------------------
        const existing = await docClient.send(new GetCommand({
            TableName: CAMPAIGN_TABLE,
            Key: { id: campaignId }
        }));

        if (!existing.Item) {
            return response(404, "Campaign not found");
        }

        const campaign = existing.Item;

        // -----------------------------
        // 2. CHECK OWNER
        // -----------------------------
        if (campaign.email !== email) {
            return response(403, "Unauthorized");
        }

        // -----------------------------
        // 3. STATUS CHECK
        // -----------------------------
        if (["inprogress", "completed"].includes(campaign.status)) {
            return response(400, "Cannot delete this campaign");
        }

        // -----------------------------
        // 4. DELETE CSV FROM S3 (optional)
        // -----------------------------
        if (campaign.csvUrl) {
            const key = extractS3Key(campaign.csvUrl);

            await s3.send(new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key
            }));
        }

        // -----------------------------
        // 5. DELETE FROM DB
        // -----------------------------
        await docClient.send(new DeleteCommand({
            TableName: CAMPAIGN_TABLE,
            Key: { id: campaignId }
        }));

        // -----------------------------
        // 6. RESPONSE
        // -----------------------------
        return response(200, {
            message: "Campaign deleted successfully",
            campaignId
        });

    } catch (error) {
        console.error(error);
        return response(500, error.message);
    }
};


// -----------------------------
// HELPER: Extract S3 key
// -----------------------------
const extractS3Key = (url) => {
    const parts = url.split(".amazonaws.com/");
    return parts[1];
};


// -----------------------------
const response = (statusCode, body) => ({
    statusCode,
    body: JSON.stringify(body)
});