import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  PutCommand,
 GetCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

import bcrypt from "bcryptjs";

// ======================
// DynamoDB Configuration
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const ddbDocClient =
  DynamoDBDocumentClient.from(client);

// ======================
// Table Name
// ======================

const TABLE_NAME =
  "rcs_admin_and_users";

// ======================
// Response Function
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
// UPDATED PHONE VALIDATION
// Supports:
// 9876543210
// 919876543210
// +919876543210
// Rejects:
// alphabets
// short numbers
// long numbers
// invalid indian numbers
// ======================

const isValidIndianMobileNumber =
  (phone) => {

    if (!phone)
      return false;

    let cleaned =
      phone
        .toString()
        .replace(/\D/g, "");

    // remove 91 only if actual country code
    if (
      cleaned.length === 12 &&
      cleaned.startsWith("91")
    ) {

      cleaned =
        cleaned.slice(2);
    }

    return /^[6-9]\d{9}$/
      .test(cleaned);
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
  // 1 special character

  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_\-+=])[A-Za-z\d@$!%*?&#^()_\-+=]{8,}$/
    .test(password);
};
// ======================
// Hex Color Validation
// ======================

const isValidHexColor =
  (color) => {

    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/
      .test(color);
  };

// ======================
// Lambda Handler
// ======================

export const handler =
  async (event) => {

    try {

      // ======================
      // Parse Request
      // ======================

      const body =
        typeof event.body === "string"
          ? JSON.parse(event.body)
          : event;

      let {

        username,
        email,
        password,
        role,
        billingMethod,
        priority,
        status,
        billingCycle,
        expiryDate,
        phone,
        userType,
        themeColor,
        configuration,
        firstName,
        lastName,
        createdBy

      } = body;

      // ======================
      // Required Fields
      // ======================

      if (
        !email ||
        !password ||
        !phone
      ) {

        return sendResponse(
          400,
          {
            message:
              "email, password and mobileNumber are required"
          }
        );
      }

      // ======================
      // Lowercase Email
      // ======================

      email =
        email.toLowerCase();

      // ======================
      // PHONE NORMALIZATION
      // Store only 10 digit
      // ======================

      phone =
        phone
          .toString()
          .replace(/\D/g, "");

      if (
        phone.length === 12 &&
        phone.startsWith("91")
      ) {

        phone =
          phone.slice(2);
      }

      // ======================
      // Lowercase Fields
      // ======================

      username = username
        ? username.toLowerCase()
        : "";

      firstName = firstName
        ? firstName.toLowerCase()
        : "";

      lastName = lastName
        ? lastName.toLowerCase()
        : "";

      role = role
        ? role.toLowerCase()
        : "user";

      billingMethod =
        billingMethod
          ? billingMethod.toLowerCase()
          : "wallet";

      priority =
        priority
          ? priority.toLowerCase()
          : "low";

      status = status
        ? status.toLowerCase()
        : "active";

      billingCycle =
        billingCycle
          ? billingCycle.toLowerCase()
          : "monthly";

      userType = userType
        ? userType.toLowerCase()
        : "seller";

      createdBy = createdBy
        ? createdBy.toLowerCase()
        : "system";

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
      // Phone Validation
      // ======================

      if (
        !isValidIndianMobileNumber(phone)
      ) {

        return sendResponse(
          400,
          {
            message:
              "Invalid phone number"
          }
        );
      }

      // ======================
      // Password Validation
      // ======================

      if (
        !isStrongPassword(
          password
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
      // Role Validation
      // ======================

      const allowedRoles = [
        "admin",
        "super-admin",
        "user"
      ];

      if (
        role &&
        !allowedRoles.includes(role)
      ) {

        return sendResponse(
          400,
          {
            message:
              "Invalid role"
          }
        );
      }

      // ======================
      // Status Validation
      // ======================

      const allowedStatus = [
        "active",
        "inactive"
      ];

      if (
        status &&
        !allowedStatus.includes(status)
      ) {

        return sendResponse(
          400,
          {
            message:
              "Invalid status"
          }
        );
      }

      // ======================
      // Theme Color Validation
      // ======================

      if (
        themeColor &&
        !isValidHexColor(themeColor)
      ) {

        return sendResponse(
          400,
          {
            message:
              "Invalid theme color"
          }
        );
      }

      // ======================
      // CHECK EXISTING EMAIL
      // ======================

      const existingUser =
        await ddbDocClient.send(

          new GetCommand({

            TableName:
              TABLE_NAME,

            Key: {
              id: email
            }
          })
        );

      if (
        existingUser.Item
      ) {

        return sendResponse(
          409,
          {
            message:
              "User already exists"
          }
        );
      }

      // ======================
      // CHECK DUPLICATE USERNAME
      // username-index required
      // ======================

      if (username) {

        const usernameData =
          await ddbDocClient.send(

            new QueryCommand({

              TableName:
                TABLE_NAME,

              IndexName:
                "username-index",

              KeyConditionExpression:
                "username = :username",

              ExpressionAttributeValues: {

                ":username":
                  username
              }
            })
          );

        if (
          usernameData.Items &&
          usernameData.Items.length > 0
        ) {

          return sendResponse(
            409,
            {
              message:
                "Username already exists"
            }
          );
        }
      }

      // ======================
      // Password Hashing
      // ======================

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      const timestamp =
        new Date().toISOString();

      // ======================
      // Configuration
      // ======================

      const config =
        configuration || {};

      // ======================
      // User Object
      // ======================

      const userData = {

        id: email,

        username,

        password:
          hashedPassword,

        phone,

        firstName,

        lastName,

        role,

        createdBy,

        billingMethod,

        priority,

        status,

        billingCycle,

        expiryDate:
          expiryDate || null,

        userType,

        themeColor:
          themeColor || "",

        configuration: {

          messageExpiry:
            !!config.messageExpiry,

          dirHandover:
            !!config.dirHandover,

          numberBlacklistAllow:
            !!config.numberBlacklistAllow,

          frequency:
            !!config.frequency
        },

        createdAt:
          timestamp,

        updatedAt:
          timestamp,

        lastLoginTime:
          ""
      };

      // ======================
      // Save User
      // ======================

      await ddbDocClient.send(

        new PutCommand({

          TableName:
            TABLE_NAME,

          Item:
            userData
        })
      );

      // ======================
      // Remove Password
      // ======================

      const {
        password: _,
        ...responseData

      } = userData;

      // ======================
      // Success Response
      // ======================

      return sendResponse(
        201,
        {

          message:
            "User created successfully",

          user:
            responseData
        }
      );

    } catch (error) {

      console.error(
        "Create User Error:",
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


















































































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   PutCommand,
//   GetCommand
// } from "@aws-sdk/lib-dynamodb";

// import bcrypt from "bcryptjs";

// // ======================
// // DynamoDB Configuration
// // ======================

// const client = new DynamoDBClient({
//   region: "ap-south-1"
// });

// const ddbDocClient = DynamoDBDocumentClient.from(client);

// // ======================
// // Table Name
// // ======================

// const TABLE_NAME = "rcs_admin_and_users";

// // ======================
// // Response Function
// // ======================

// const sendResponse = (statusCode, body) => {
//   return {
//     statusCode,
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify(body)
//   };
// };

// // ======================
// // Validations
// // ======================

// const isValidEmail = (email) => {
//   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
// };

// const isValidIndianMobileNumber = (phone) => {
//   return /^[6-9]\d{9}$/.test(phone);
// };

// const isValidHexColor = (color) => {
//   return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
// };

// // ======================
// // Lambda Handler
// // ======================

// export const handler = async (event) => {
//   try {

//     // ======================
//     // Parse Request
//     // ======================

//     const body =
//       typeof event.body === "string"
//         ? JSON.parse(event.body)
//         : event;

//     let {
//       username,
//       email,
//       password,
//       role,
//       billingMethod,
//       priority,
//       status,
//       billingCycle,
//       expiryDate,
//       phone,
//       userType,
//       themeColor,
//       configuration,
//       firstName,
//       lastName,
//       createdBy
//     } = body;

//     // ======================
//     // Required Fields
//     // ======================

//     if (!email || !password || !phone) {
//       return sendResponse(400, {
//         message: "email, password and mobileNumber are required"
//       });
//     }

//     // ======================
//     // Lowercase Fields
//     // ======================

//     email = email.toLowerCase();

//     username = username
//       ? username.toLowerCase()
//       : "";

//     firstName = firstName
//       ? firstName.toLowerCase()
//       : "";

//     lastName = lastName
//       ? lastName.toLowerCase()
//       : "";

//     role = role
//       ? role.toLowerCase()
//       : "user";

//     billingMethod = billingMethod
//       ? billingMethod.toLowerCase()
//       : "wallet";

//     priority = priority
//       ? priority.toLowerCase()
//       : "low";

//     status = status
//       ? status.toLowerCase()
//       : "active";

//     billingCycle = billingCycle
//       ? billingCycle.toLowerCase()
//       : "monthly";

//     userType = userType
//       ? userType.toLowerCase()
//       : "client";

//     createdBy = createdBy
//       ? createdBy.toLowerCase()
//       : "system";

//     // ======================
//     // Validations
//     // ======================

//     if (!isValidEmail(email)) {
//       return sendResponse(400, {
//         message: "Invalid email format"
//       });
//     }

//     // Phone validation
// if (!isValidIndianMobileNumber(phone)) {
//   return sendResponse(400, {
//     message: "Invalid phone number"
//   });
// }

//     if (themeColor && !isValidHexColor(themeColor)) {
//       return sendResponse(400, {
//         message: "Invalid theme color"
//       });
//     }

//     // ======================
//     // Check Existing User
//     // ======================

//     const existingUser = await ddbDocClient.send(
//       new GetCommand({
//         TableName: TABLE_NAME,
//         Key: {
//           id: email
//         }
//       })
//     );

//     if (existingUser.Item) {
//       return sendResponse(409, {
//         message: "User already exists"
//       });
//     }

//     // ======================
//     // Hash Password
//     // ======================

//     const hashedPassword = await bcrypt.hash(password, 10);

//     const timestamp = new Date().toISOString();

//     // ======================
//     // Configuration
//     // ======================

//     const config = configuration || {};

//     // ======================
//     // User Object
//     // ======================

//     const userData = {
//       id: email,

//       username,

//       //email,

//       password: hashedPassword,

//       phone,

//       firstName,

//       lastName,

//       role,

//       createdBy,

//       billingMethod,

//       priority,

//       status,

//       billingCycle,

//       expiryDate: expiryDate || "",

//       userType,

//       themeColor: themeColor || "",

//       configuration: {
//         messageExpiry: !!config.messageExpiry,
//         dirHandover: !!config.dirHandover,
//         numberBlacklistAllow: !!config.numberBlacklistAllow,
//         frequency: !!config.frequency
//       },

//       createdAt: timestamp,

//       updatedAt: timestamp,

//       lastLoginTime: ""
//     };

//     // ======================
//     // Save User
//     // ======================

//     await ddbDocClient.send(
//       new PutCommand({
//         TableName: TABLE_NAME,
//         Item: userData
//       })
//     );

//     // ======================
//     // Remove Password
//     // ======================

//     const { password: _, ...responseData } = userData;

//     // ======================
//     // Success Response
//     // ======================

//     return sendResponse(201, {
//       message: "User created successfully",
//       user: responseData
//     });

//   } catch (error) {

//     console.error("Create User Error:", error);

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });

//   }
// };





