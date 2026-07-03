import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DB Setup
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_bots";

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
// Get All Bots API
// ======================

export const handler = async () => {
  try {

    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME
      })
    );

    let bots = result.Items || [];

    // ======================
    // Latest Bots First
    // ======================

    bots.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    return sendResponse(200, {
      message: "Bots fetched successfully",
      totalBots: bots.length,
      bots
    });

  } catch (error) {

    console.error(
      "Get Bots Error:",
      error
    );

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};