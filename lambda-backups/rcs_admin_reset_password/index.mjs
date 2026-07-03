import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

import bcrypt from "bcryptjs";

// ======================
// DynamoDB Configuration
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

// ======================
// Table Name
// ======================

const TABLE_NAME =
  "rcs_admin_and_users";

// ======================
// Response Helper
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

    body:
      JSON.stringify(body)
  };
};

// ======================
// Email Validation
// ======================

const isValidEmail = (
  email
) => {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
};

// ======================
// Strong Password Validation
// ======================

const isStrongPassword = (
  password
) => {

  // Minimum:
  // 8 chars
  // 1 uppercase
  // 1 lowercase
  // 1 number
  // 1 special char

  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/
    .test(password);
};

// ======================
// Reset Password API
// ======================

export const handler =
  async (event) => {

    try {

      // ======================
      // Parse Request
      // ======================

      let {
        email,
        otp,
        newPassword
      } = event;

      // ======================
      // Required Validation
      // ======================

      if (
        !email ||
        !otp ||
        !newPassword
      ) {

        return sendResponse(
          400,
          {
            message:
              "email, otp and newPassword are required"
          }
        );
      }

      // ======================
      // Normalize Email
      // ======================

      email =
        email.toLowerCase().trim();

      // ======================
      // Email Validation
      // ======================

      if (
        !isValidEmail(email)
      ) {

        return sendResponse(
          400,
          {
            message:
              "Invalid email format"
          }
        );
      }

      // ======================
      // Password Validation
      // ======================

      if (
        !isStrongPassword(
          newPassword
        )
      ) {

        return sendResponse(
          400,
          {
            message:
              "Password must contain minimum 8 characters, including uppercase, lowercase, number and special character"
          }
        );
      }

      // ======================
      // Fetch User
      // ======================

      const result =
        await docClient.send(

          new GetCommand({

            TableName:
              TABLE_NAME,

            Key: {
              id: email
            }
          })
        );

      const user =
        result.Item;

      // ======================
      // User Validation
      // ======================

      if (!user) {

        return sendResponse(
          404,
          {
            message:
              "User not found"
          }
        );
      }

      // ======================
      // Check OTP Exists
      // ======================

      if (
        !user.forgotPasswordOtp ||
        !user.forgotPasswordOtpExpiry
      ) {

        return sendResponse(
          400,
          {
            message:
              "OTP not found or expired"
          }
        );
      }

      // ======================
      // Check OTP Expiry
      // ======================

      if (
        Date.now() >
        user.forgotPasswordOtpExpiry
      ) {

        return sendResponse(
          400,
          {
            message:
              "OTP expired"
          }
        );
      }

      // ======================
      // Compare OTP
      // ======================

      const isOtpValid =
        await bcrypt.compare(
          otp.toString(),
          user.forgotPasswordOtp
        );

      if (!isOtpValid) {

        return sendResponse(
          400,
          {
            message:
              "Invalid OTP"
          }
        );
      }

      // ======================
      // Hash New Password
      // ======================

      const hashedPassword =
        await bcrypt.hash(
          newPassword,
          10
        );

      // ======================
      // Update Password
      // Remove OTP fields
      // ======================

      await docClient.send(

        new UpdateCommand({

          TableName:
            TABLE_NAME,

          Key: {
            id: email
          },

          UpdateExpression:
            `
            SET
            password = :password,
            updatedAt = :updatedAt

            REMOVE
            forgotPasswordOtp,
            forgotPasswordOtpExpiry
            `,

          ExpressionAttributeValues: {

            ":password":
              hashedPassword,

            ":updatedAt":
              new Date().toISOString()
          }
        })
      );

      // ======================
      // Success Response
      // ======================

      return sendResponse(
        200,
        {
          message:
            "Password reset successfully"
        }
      );

    } catch (error) {

      console.error(
        "Reset Password Error:",
        error
      );

      return sendResponse(
        500,
        {
          message:
            "Internal server error",

          error:
            error.message
        }
      );
    }
};