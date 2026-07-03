import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_bots";
const GSI_NAME = "status-index";

const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  try {
    console.log("Incoming event:", JSON.stringify(event));

    let email = event.email;

    if (!email || typeof email !== "string") {
      return sendResponse(400, {
        message: "Valid email is required"
      });
    }

    email = email.trim().toLowerCase();

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI_NAME,
        KeyConditionExpression: "#status = :status",
        FilterExpression: "email = :email",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: {
          ":status": "launched",
          ":email": email
        }
      })
    );

    return sendResponse(200, {
      message: "Launched bots fetched successfully",
      count: result.Items?.length || 0,
      bots: result.Items || []
    });

  } catch (error) {
    console.error("Error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};