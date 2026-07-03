import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_templates";

// ✅ Response helper
const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  try {
    // ✅ Parse body
    const body = event;

    const { id } = body;

    // ✅ Validate
    if (!id || typeof id !== "string") {
      return sendResponse(400, {
        message: "Valid templateId is required"
      });
    }

    // ✅ Fetch from DB
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: id}
      })
    );

    //  Not found
    if (!Item) {
      return sendResponse(404, {
        message: "Template not found"
      });
    }

    // ✅ Success
    return sendResponse(200, {
      message: "Template fetched successfully",
      template: Item
    });

  } catch (error) {
    console.error("Get template error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};