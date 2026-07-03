import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand
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
// Main Handler
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

    let {
      email,
      username,
      userType,
      status
    } = body;

    // ======================
    // Get By Email
    // ======================

    if (email) {

      email = email.toLowerCase();

      const result = await ddbDocClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            id: email
          }
        })
      );

      if (!result.Item) {
        return sendResponse(404, {
          message: "User not found"
        });
      }

      const { password, ...userData } = result.Item;

      return sendResponse(200, {
        message: "User fetched successfully",
        user: userData
      });
    }

    // ======================
    // Get By Username
    // ======================

    if (username) {

      username = username.toLowerCase();

      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "username-index",

          KeyConditionExpression:
            "username = :username",

          ExpressionAttributeValues: {
            ":username": username
          }
        })
      );

      const users = result.Items || [];

      const finalUsers = users.map(user => {
        const { password, ...rest } = user;
        return rest;
      });

      return sendResponse(200, {
        message: "Users fetched successfully",
        totalUsers: finalUsers.length,
        users: finalUsers
      });
    }

    // ======================
    // Get By UserType
    // ======================

    if (userType) {

      userType = userType.toLowerCase();

      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "userType-index",

          KeyConditionExpression:
            "userType = :userType",

          ExpressionAttributeValues: {
            ":userType": userType
          }
        })
      );

      const users = result.Items || [];

      const finalUsers = users.map(user => {
        const { password, ...rest } = user;
        return rest;
      });

      return sendResponse(200, {
        message: "Users fetched successfully",
        totalUsers: finalUsers.length,
        users: finalUsers
      });
    }
    
    // Get By Status
    // ======================

    if (status) {

      status = status.toLowerCase();

      const result = await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "status-index",

          KeyConditionExpression:
            "#status = :status",

          ExpressionAttributeValues: {
            ":status": status
          },

          ExpressionAttributeNames: {
            "#status": "status"
          }
        })
      );

      const users = result.Items || [];

      const finalUsers = users.map(user => {
        const { password, ...rest } = user;
        return rest;
      });

      return sendResponse(200, {
        message: "Users fetched successfully",
        totalUsers: finalUsers.length,
        users: finalUsers
      });
    }
    // ======================
    // No Field Provided
    // ======================

    return sendResponse(400, {
      message:
        "Please provide email or username or userType or status"
    });

  } catch (error) {

    console.error("Get User Error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};