import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_bots";

const GSI_NAME = "email-index";

// ======================
// Response Helper
// ======================

const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

// ======================
// Get User Bots API
// ======================

export const handler = async (event) => {
  try {

    console.log(
      "Incoming event:",
      JSON.stringify(event)
    );

    // ======================
    // Direct Extraction
    // ======================

    let email = event.email;

    if (!email || typeof email !== "string") {
      return sendResponse(400, {
        message: "Valid email is required"
      });
    }

    email = email.trim().toLowerCase();

    // ======================
    // Query Bots
    // ======================

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        IndexName: GSI_NAME,

        KeyConditionExpression:
          "email = :email",

        FilterExpression:
          "#status = :status",

        ExpressionAttributeNames: {
          "#status": "status"
        },

        ExpressionAttributeValues: {
          ":email": email,
          ":status": "launched"
        }
      })
    );

    let bots = result.Items || [];

    // ======================
    // Latest First
    // ======================

    bots.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    return sendResponse(200, {
      message:
        "Launched bots fetched successfully",

      count: bots.length,

      bots
    });

  } catch (error) {

    console.error("Error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};