import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

// DB setup
const ddbClient = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// S3 setup
const s3Client = new S3Client({ region: "ap-south-1" });

const TABLE_NAME = "rcs_templates";
const BUCKET_NAME = "rcs-main"; 

// Response helper
const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

// Extract S3 key from URL
const extractKeyFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return decodeURIComponent(urlObj.pathname.substring(1));
  } catch {
    return null;
  }
};

export const handler = async (event) => {
  try {
    const body = event;

    const {id, cardUrl } = body;

    // ✅ Validate
    if (!id) {
      return sendResponse(400, {
        message: "templateId is required"
      });
    }

    // ✅ Check if template exists
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: id }
      })
    );

    if (!Item) {
      return sendResponse(404, {
        message: "Template does not exist"
      });
    }

    //  Delete image from S3 (if provided)
    if (cardUrl) {
      const key = extractKeyFromUrl(cardUrl);

      if (key) {
        try {
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key
            })
          );
        } catch (s3Error) {
          console.error("S3 delete error:", s3Error);
          // Optional: continue even if S3 delete fails
        }
      }
    }

    //Delete from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { id: id }
      })
    );

    return sendResponse(200, {
      message: "Template deleted successfully"
    });

  } catch (error) {
    console.error("Delete template error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};