import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand,GetCommand} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// ✅ DB setup
const ddbClient = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// ✅ S3 setup
const s3Client = new S3Client({ region: "ap-south-1" });

const TABLE_NAME = "rcs_bots";

// ✅ Response helper
const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

// ✅ Extract S3 key from URL
const extractKeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return decodeURIComponent(urlObj.pathname.substring(1)); // remove leading '/'
  } catch {
    return null;
  }
};

export const handler = async (event) => {
  try {
    const body = event;

    const { botId, botLogo, bannerImage } = body;

    if (!botId) {
      return sendResponse(400, {
        message: "botId is required"
      });
    }
  // ✅ 1. Check if bot exists
  const { Item } = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { id: botId }
    })
  );

  if (!Item) {
    return sendResponse(404, {
      message: "Bot does not exist"
    });
  }
    // ✅ Delete images from S3 (if provided)
    const deletePromises = [];

    const BUCKET_NAME = "rcs-main";

    if (botLogo) {
      const key = extractKeyFromUrl(botLogo);
      if (key) {
        deletePromises.push(
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key
            })
          )
        );
      }
    }

    if (bannerImage) {
      const key = extractKeyFromUrl(bannerImage);
      if (key) {
        deletePromises.push(
          s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key
            })
          )
        );
      }
    }

    // wait for all S3 deletes
    await Promise.all(deletePromises);

    // ✅ Delete from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: botId }
      })
    );

    return sendResponse(200, {
      message: "Bot and associated files deleted successfully"
    });

  } catch (error) {
    console.error("Delete bot error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};