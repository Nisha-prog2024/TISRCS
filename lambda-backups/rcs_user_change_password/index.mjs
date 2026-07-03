import {
    DynamoDBClient
  } from "@aws-sdk/client-dynamodb";
  
  import {
    DynamoDBDocumentClient,
    GetCommand,
    UpdateCommand
  } from "@aws-sdk/lib-dynamodb";
  
  import bcrypt from "bcryptjs";
  
  // ======================
  // AWS CONFIG
  // ======================
  
  const client =
    new DynamoDBClient({
      region: "ap-south-1"
    });
  
  const docClient =
    DynamoDBDocumentClient.from(
      client
    );
  
  // ======================
  // TABLE
  // ======================
  
  const TABLE_NAME =
    "rcs_admin_and_users";
  
  // ======================
  // RESPONSE FUNCTION
  // ======================
  
  const sendResponse = (
    statusCode,
    body
  ) => ({
  
    statusCode,
  
    headers: {
      "Content-Type":
        "application/json"
    },
  
    body: JSON.stringify(body)
  
  });
  
  // ======================
  // HANDLER
  // ======================
  
  export const handler = async (
    event
  ) => {
  
    try {
  
      // ======================
      // PARSE REQUEST
      // ======================
  
      let {
  
        email,
  
        oldPassword,
  
        newPassword
  
      } = event;
  
      // ======================
      // VALIDATION
      // ======================
  
      if (
        !email ||
        !oldPassword ||
        !newPassword
      ) {
  
        return sendResponse(400, {
  
          message:
            "email, oldPassword and newPassword are required"
  
        });
  
      }
  
      email =
        email.toLowerCase();
  
      // ======================
      // FETCH USER
      // ======================
  
      const { Item } =
        await docClient.send(
  
          new GetCommand({
  
            TableName:
              TABLE_NAME,
  
            Key: {
              id: email
            }
  
          })
  
        );
  
      // ======================
      // USER NOT FOUND
      // ======================
  
      if (!Item) {
  
        return sendResponse(404, {
  
          message:
            "User not found"
  
        });
  
      }
  
      // ======================
      // VERIFY OLD PASSWORD
      // ======================
  
      const isValidPassword =
        await bcrypt.compare(
          oldPassword,
          Item.password
        );
  
      if (!isValidPassword) {
  
        return sendResponse(401, {
  
          message:
            "Old password is incorrect"
  
        });
  
      }
  
      // ======================
      // NEW PASSWORD SHOULD
      // NOT MATCH OLD PASSWORD
      // ======================
  
      if (oldPassword === newPassword) {
  
        return sendResponse(400, {
  
          message:
            "New password must be different from old password"
  
        });
  
      }
  
      // ======================
      // PASSWORD STRENGTH
      // VALIDATION
      // ======================
  
      const passwordRegex =
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&^#])[A-Za-z\d@$!%*?&^#]{8,}$/;
  
      if (!passwordRegex.test(newPassword)) {
  
        return sendResponse(400, {
  
          message:
            "Password must be at least 8 characters long and contain at least 1 uppercase letter, 1 lowercase letter, 1 number and 1 special character"
  
        });
  
      }
  
      // ======================
      // HASH NEW PASSWORD
      // ======================
  
      const hashedPassword =
        await bcrypt.hash(
          newPassword,
          10
        );
  
      // ======================
      // UPDATE PASSWORD
      // ======================
  
      await docClient.send(
  
        new UpdateCommand({
  
          TableName:
            TABLE_NAME,
  
          Key: {
            id: email
          },
  
          UpdateExpression:
            "SET password = :password, updatedAt = :updatedAt",
  
          ExpressionAttributeValues: {
  
            ":password":
              hashedPassword,
  
            ":updatedAt":
              new Date().toISOString()
  
          }
  
        })
  
      );
  
      // ======================
      // SUCCESS RESPONSE
      // ======================
  
      return sendResponse(200, {
  
        message:
          "Password changed successfully"
  
      });
  
    } catch (error) {
  
      console.error(
        "Change Password Error:",
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