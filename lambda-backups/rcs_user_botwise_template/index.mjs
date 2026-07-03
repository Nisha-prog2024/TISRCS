import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

// ✅ DB setup
const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TEMPLATE_TABLE = "rcs_templates";

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

    let { botName, status } = body;

    if (!botName) {
      return sendResponse(400, {
        message: "botName is required"
      });
    }

    // ✅ Normalize
    botName = botName.toLowerCase();
    if (status) status = status.toLowerCase();

    // ✅ Query params
    const queryParams = {
      TableName: TEMPLATE_TABLE,
      IndexName: "botName-index", // GSI

      KeyConditionExpression: "botName = :botName",

      ExpressionAttributeValues: {
        ":botName": botName
      }
    };

    // ✅ Add filter for status (NOT KeyCondition)
    if (status) {
      queryParams.FilterExpression = "#status = :status";
      queryParams.ExpressionAttributeNames = {
        "#status": "status"
      };
      queryParams.ExpressionAttributeValues[":status"] = status;
    }

    // ✅ Execute query
    const { Items } = await docClient.send(
      new QueryCommand(queryParams)
    );

    return sendResponse(200, {
      message: "Templates retrieved successfully",
      count: Items?.length || 0,
      templates: Items || []
    });

  } catch (error) {
    console.error("GetTemplate error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};