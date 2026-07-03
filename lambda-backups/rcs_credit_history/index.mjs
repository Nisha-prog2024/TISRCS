import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DynamoDB Config
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const ddbDocClient =
  DynamoDBDocumentClient.from(client);

// ======================
// Table Name
// ======================

const CREDIT_TABLE =
  "rcs_credit";

// ======================
// Common Response
// ======================

const sendResponse = (
  statusCode,
  body
) => {
  return {
    statusCode,

    headers: {
      "Content-Type":
        "application/json"
    },

    body: JSON.stringify(body)
  };
};

// ======================
// Lambda Handler
// ======================

export const handler = async () => {

  try {

    // ======================
    // Fetch Credit History
    // ======================

    const response =
      await ddbDocClient.send(
        new ScanCommand({
          TableName:
            CREDIT_TABLE
        })
      );

    // ======================
    // Sort Latest First
    // ======================

    const sortedData =
      (response.Items || []).sort(
        (a, b) =>
          new Date(
            b.createdAt
          ) -
          new Date(
            a.createdAt
          )
      );

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message:
        "Credit history fetched successfully",

      totalRecords:
        sortedData.length,

      data:
        sortedData
    });

  } catch (error) {

    console.error(
      "Fetch Credit History Error:",
      error
    );

    return sendResponse(500, {
      message:
        "Internal server error",

      error:
        error.message
    });

  }

};