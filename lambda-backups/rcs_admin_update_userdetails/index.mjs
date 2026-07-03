import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

import bcrypt from "bcryptjs";

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
// Validations
// ======================

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidIndianMobileNumber = (mobile) => {
  return /^[6-9]\d{9}$/.test(mobile);
};

// ======================
// Update User API
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
      firstName,
      lastName,
      role,
      billingMethod,
      priority,
      status,
      billingCycle,
      expiryDate,
      phone,
      userType,
      themeColor,
      createdBy,
      configuration,
      password
    } = body;

    // ======================
    // Required Field
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
    // Lowercase Fields
    // ======================

    if (username) username = username.toLowerCase();

    if (firstName) firstName = firstName.toLowerCase();

    if (lastName) lastName = lastName.toLowerCase();

    if (role) role = role.toLowerCase();

    if (billingMethod) {
      billingMethod = billingMethod.toLowerCase();
    }

    if (priority) {
      priority = priority.toLowerCase();
    }

    if (status) {
      status = status.toLowerCase();
    }

    if (billingCycle) {
      billingCycle = billingCycle.toLowerCase();
    }

    if (userType) {
      userType = userType.toLowerCase();
    }

    if (createdBy) {
      createdBy = createdBy.toLowerCase();
    }

    // ======================
    // Validations
    // ======================

    if (!isValidEmail(email)) {
      return sendResponse(400, {
        message: "Invalid email format"
      });
    }

    if (phone && !isValidIndianMobileNumber(phone)) {
      return sendResponse(400, {
        message: "Invalid phone number"
      });
    }

    // ======================
    // Update Expression
    // ======================

    let updateExpression =
      "set updatedAt = :updatedAt";

    let expressionAttributeValues = {
      ":updatedAt": new Date().toISOString()
    };

    let expressionAttributeNames = {};

    // ======================
    // Dynamic Fields
    // ======================

    if (username) {
      updateExpression += ", username = :username";
      expressionAttributeValues[":username"] =
        username;
    }

    if (firstName) {
      updateExpression +=
        ", firstName = :firstName";

      expressionAttributeValues[":firstName"] =
        firstName;
    }

    if (lastName) {
      updateExpression +=
        ", lastName = :lastName";

      expressionAttributeValues[":lastName"] =
        lastName;
    }

    // ======================
    // Reserved Keyword: role
    // ======================

    if (role) {

      updateExpression += ", #role = :role";

      expressionAttributeValues[":role"] =
        role;

      expressionAttributeNames["#role"] =
        "role";
    }

    if (billingMethod) {
      updateExpression +=
        ", billingMethod = :billingMethod";

      expressionAttributeValues[
        ":billingMethod"
      ] = billingMethod;
    }

    if (priority) {
      updateExpression +=
        ", priority = :priority";

      expressionAttributeValues[
        ":priority"
      ] = priority;
    }

    if (status) {
      updateExpression +=
        ", #status = :status";

      expressionAttributeValues[
        ":status"
      ] = status;

      expressionAttributeNames["#status"] =
        "status";
    }

    if (billingCycle) {
      updateExpression +=
        ", billingCycle = :billingCycle";

      expressionAttributeValues[
        ":billingCycle"
      ] = billingCycle;
    }

    if (expiryDate) {
      updateExpression +=
        ", expiryDate = :expiryDate";

      expressionAttributeValues[
        ":expiryDate"
      ] = expiryDate;
    }

    if (phone) {
      updateExpression += ", phone = :phone";

      expressionAttributeValues[
        ":phone"
      ] = phone;
    }

    if (userType) {
      updateExpression +=
        ", userType = :userType";

      expressionAttributeValues[
        ":userType"
      ] = userType;
    }

    if (themeColor) {
      updateExpression +=
        ", themeColor = :themeColor";

      expressionAttributeValues[
        ":themeColor"
      ] = themeColor;
    }

    if (createdBy) {
      updateExpression +=
        ", createdBy = :createdBy";

      expressionAttributeValues[
        ":createdBy"
      ] = createdBy;
    }

    if (configuration) {

      updateExpression +=
        ", configuration = :configuration";

      expressionAttributeValues[
        ":configuration"
      ] = configuration;
    }

    // ======================
    // Password Update
    // ======================

    if (password) {

      const hashedPassword =
        await bcrypt.hash(password, 10);

      updateExpression +=
        ", password = :password";

      expressionAttributeValues[
        ":password"
      ] = hashedPassword;
    }

    // ======================
    // Update User
    // ======================

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,

        Key: {
          id: email
        },

        UpdateExpression:
          updateExpression,

        ExpressionAttributeValues:
          expressionAttributeValues,

        ExpressionAttributeNames:
          expressionAttributeNames,

        ReturnValues: "ALL_NEW"
      })
    );

    // ======================
    // Fetch Updated User
    // ======================

    const updatedUser = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,

        Key: {
          id: email
        }
      })
    );

    // ======================
    // Remove Password
    // ======================

    const { password: _, ...userData } =
      updatedUser.Item;

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message: "User updated successfully",
      user: userData
    });

  } catch (error) {

    console.error(
      "Update User Error:",
      error
    );

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};