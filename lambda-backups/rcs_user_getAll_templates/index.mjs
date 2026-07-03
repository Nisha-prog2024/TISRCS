import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_templates";
const GSI_NAME = "email-index";

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

    let { email } = body;

    if (!email) {
      return sendResponse(400, {
        message: "email is required"
      });
    }

    //  match how you stored email
    email = email.toLowerCase();

    // ✅ Query GSI
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI_NAME,
        KeyConditionExpression: "email = :email",
        ExpressionAttributeValues: {
          ":email": email
        }
      })
    );

    let templates = result.Items || [];

    // ✅ Sort latest first (using tstamp)
    templates.sort((a, b) => b.tstamp - a.tstamp);

    return sendResponse(200, {
      message: "Templates fetched successfully",
      count: templates.length,
      templates
    });

  } catch (error) {
    console.error("Get templates error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};