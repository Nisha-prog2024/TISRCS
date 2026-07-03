import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DynamoDB Configuration
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const ddbDocClient = DynamoDBDocumentClient.from(client);

// ======================
// Table Name
// ======================

const TABLE_NAME = "rcs_admin_and_users";

// ======================
// Response Function
// ======================

const sendResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

// ======================
// Delete User API
// ======================

export const handler = async (event) => {
  try {

    // ======================
    // Parse Request
    // ======================

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event;

    let { email } = body;

    // ======================
    // Validation
    // ======================

    if (!email) {
      return sendResponse(400, {
        message: "email is required"
      });
    }

    email = email.toLowerCase();

    // ======================
    // Check User Exists
    // ======================

    const existingUser = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          id: email
        }
      })
    );

    if (!existingUser.Item) {
      return sendResponse(404, {
        message: "User not found"
      });
    }

    // ======================
    // Delete User
    // ======================

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          id: email
        }
      })
    );

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message: "User deleted successfully"
    });

  } catch (error) {

    console.error(
      "Delete User Error:",
      error
    );

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};