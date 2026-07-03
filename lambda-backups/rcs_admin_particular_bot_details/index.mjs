import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_bots";

// response helper
const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    // ✅ support all cases (test, GET, POST)
    let botId =
      event.botId ||
      event.queryStringParameters?.botId ||
      (event.body ? JSON.parse(event.body).botId : null);

    if (!botId || typeof botId !== "string") {
      return sendResponse(400, {
        message: "Valid botId is required"
      });
    }

    botId = botId.trim();

    // ✅ Get item from DynamoDB
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          id: botId
        }
      })
    );

    if (!result.Item) {
      return sendResponse(404, {
        message: "Bot not found"
      });
    }

    return sendResponse(200, {
      message: "Bot fetched successfully",
      bot: result.Item
    });

  } catch (error) {
    console.error("Error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};