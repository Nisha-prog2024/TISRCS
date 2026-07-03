import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand
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

const USERS_TABLE =
  "rcs_admin_and_users";

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

export const handler = async (
  event
) => {

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
        message:
          "email is required"
      });
    }

    email =
      email.toLowerCase();

    // ======================
    // Fetch User
    // ======================

    const response =
      await ddbDocClient.send(
        new GetCommand({
          TableName:
            USERS_TABLE,

          Key: {
            id: email
          }
        })
      );

    const user =
      response.Item;

    // ======================
    // User Not Found
    // ======================

    if (!user) {
      return sendResponse(404, {
        message:
          "User not found"
      });
    }

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message:
        "Wallet balance fetched successfully",

      data: {
        email:
          user.id,

        username:
          user.username || "",

        userType:
          user.userType || "",

          walletBalance:
          Number(
            user.walletBalance|| 0
          ),

       
      }
    });

  } catch (error) {

    console.error(
      "Fetch Wallet Balance Error:",
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