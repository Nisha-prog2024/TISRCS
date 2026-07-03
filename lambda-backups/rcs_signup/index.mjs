
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand
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
// Username GSI
// ======================

const USERNAME_INDEX =
"username-index";

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

  const regex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return regex.test(email);
};

// ======================
// Indian Mobile Validation
// ======================

const isValidIndianMobileNumber = (
  phone
) => {

  return /^[6-9]\d{9}$/
    .test(phone);
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
// Signup API
// ======================

export const handler =
  async (event) => {

    try {

      // ======================
      // Parse Request
      // ======================

      let {
        email,
        username,
        password,
        phone,
        role
      } = event;

      // ======================
      // Required Validation
      // ======================

      if (
        !email ||
        !username ||
        !password ||
        !phone
      ) {

        return sendResponse(
          400,
          {
            message:
              "email, username, password, phone are required"
          }
        );
      }

      // ======================
      // Normalize Data
      // ======================

      email =
        email.toLowerCase().trim();

      username =
        username.toLowerCase().trim();

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
      // Mobile Validation
      // ======================

      if (
        !isValidIndianMobileNumber(
          phone
        )
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
      // Check Existing User
      // ======================

      const existingUser =
        await docClient.send(

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
              "Email already registered"
          }
        );
      }
      // ======================
      // Check Duplicate Username
      // ======================

      const usernameResult =
        await docClient.send(

          new QueryCommand({

            TableName:
              TABLE_NAME,

            IndexName:
              USERNAME_INDEX,

            KeyConditionExpression:
              "username = :username",

            ExpressionAttributeValues: {

              ":username":
                username
            }
          })
        );

      if (
        usernameResult.Items &&
        usernameResult.Items.length > 0
      ) {

        return sendResponse(
          409,
          {
            message:
              "Username already exists"
          }
        );
      }

      // ======================
      // Hash Password
      // ======================

      const salt =
        await bcrypt.genSalt(10);

      const hashedPassword =
        await bcrypt.hash(
          password,
          salt
        );

      // ======================
      // Timestamp
      // ======================

      const timestamp =
        new Date().toISOString();

      // ======================
      // User Object
      // ======================

      const userToSave = {

        id: email,

        username,

        phone,
        userType:"seller",

        password:
          hashedPassword,

        role:
          role || "user",

        createdBy:
          "system",

        createdAt:
          timestamp,

        updatedAt:
          timestamp,

        status:
          "active"
      };

      // ======================
      // Save User
      // ======================

      await docClient.send(

        new PutCommand({

          TableName:
            TABLE_NAME,

          Item:
            userToSave
        })
      );

      // ======================
      // Remove Password
      // from Response
      // ======================

      const {
        password: _,
        ...userWithoutPassword

      } = userToSave;

      // ======================
      // Success Response
      // ======================

      return sendResponse(
        201,
        {

          message:
            "User registered successfully",

          user:
            userWithoutPassword
        }
      );

    } catch (error) {

      console.error(
        "Signup error:",
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
//   GetCommand,
//   QueryCommand
// } from "@aws-sdk/lib-dynamodb";

// import bcrypt from "bcryptjs";

// // ✅ DB setup
// const client = new DynamoDBClient({
//   region: "ap-south-1"
// });

// const docClient =
//   DynamoDBDocumentClient.from(client);

// const TABLE_NAME =
//   "rcs_admin_and_users";

// // ✅ Response helper
// const sendResponse = (
//   statusCode,
//   body
// ) => {

//   return {
//     statusCode,

//     headers: {
//       "Content-Type":
//         "application/json"
//     },

//     body:
//       JSON.stringify(body)
//   };
// };

// // ✅ Email validation
// const isValidEmail = (
//   email
// ) => {

//   const regex =
//     /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

//   return regex.test(email);
// };

// // ✅ Updated Indian mobile validation
// // Supports:
// // 9876543210
// // 919876543210
// // +919876543210

// const isValidIndianMobileNumber =
//   (phone) => {

//     if (!phone)
//       return false;

//     let cleaned =
//       phone
//         .toString()
//         .replace(/\D/g, "");

//     // remove 91 only if actual country code
//     if (
//       cleaned.length === 12 &&
//       cleaned.startsWith("91")
//     ) {

//       cleaned =
//         cleaned.slice(2);
//     }

//     return /^[6-9]\d{9}$/
//       .test(cleaned);
//   };

// export const handler =
//   async (event) => {

//     try {

//       let {

//         email,
//         username,
//         password,
//         phone,
//         role

//       } = event;

//       // ✅ Required fields
//       if (
//         !email ||
//         !username ||
//         !password ||
//         !phone
//       ) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "email, username, password, phone are required"
//           }
//         );
//       }

//       // ✅ Normalize
//       email =
//         email.toLowerCase();

//       username =
//         username.toLowerCase();

//       // ✅ Normalize role
//       role = role
//         ? role.toLowerCase()
//         : "user";

//       // ✅ Normalize phone
//       phone =
//         phone
//           .toString()
//           .replace(/\D/g, "");

//       // remove 91 if country code
//       if (
//         phone.length === 12 &&
//         phone.startsWith("91")
//       ) {

//         phone =
//           phone.slice(2);
//       }

//       // ✅ Email validation
//       if (
//         !isValidEmail(email)
//       ) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "Invalid email format"
//           }
//         );
//       }

//       // ✅ Phone validation
//       if (
//         !isValidIndianMobileNumber(phone)
//       ) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "Invalid phone number"
//           }
//         );
//       }

//       // ✅ Password validation
//       if (
//         password.length < 8
//       ) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "Password must be at least 8 characters"
//           }
//         );
//       }

//       // ✅ Role validation
//       const allowedRoles = [
//         "admin",
//         "super-admin"
        
//       ];

//       if (
//         role &&
//         !allowedRoles.includes(role)
//       ) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "Invalid role"
//           }
//         );
//       }

//       // ✅ Check duplicate email
//       const existingUser =
//         await docClient.send(

//           new GetCommand({

//             TableName:
//               TABLE_NAME,

//             Key: {
//               id: email
//             }
//           })
//         );

//       if (
//         existingUser.Item
//       ) {

//         return sendResponse(
//           409,
//           {
//             message:
//               "Email already registered"
//           }
//         );
//       }

//       // ✅ Check duplicate username
//       // Requires username-index GSI

//       const existingUsername =
//         await docClient.send(

//           new QueryCommand({

//             TableName:
//               TABLE_NAME,

//             IndexName:
//               "username-index",

//             KeyConditionExpression:
//               "username = :username",

//             ExpressionAttributeValues: {

//               ":username":
//                 username
//             }
//           })
//         );

//       if (
//         existingUsername.Items &&
//         existingUsername.Items.length > 0
//       ) {

//         return sendResponse(
//           409,
//           {
//             message:
//               "Username already exists"
//           }
//         );
//       }

//       // ✅ Hash password
//       const salt =
//         await bcrypt.genSalt(10);

//       const hashedPassword =
//         await bcrypt.hash(
//           password,
//           salt
//         );

//       const timestamp =
//         new Date().toISOString();

//       // ✅ Create user object
//       const userToSave = {

//         id: email,

//         username,

//         phone,

//         password:
//           hashedPassword,

//         role,

//         createdBy:
//           "system",

//         createdAt:
//           timestamp,

//         updatedAt:
//           timestamp,

//         status:
//           "active"
//       };

//       // ✅ Save in DB
//       await docClient.send(

//         new PutCommand({

//           TableName:
//             TABLE_NAME,

//           Item:
//             userToSave
//         })
//       );

//       // ✅ Remove password
//       const {
//         password: _,
//         ...userWithoutPassword

//       } = userToSave;

//       return sendResponse(
//         201,
//         {

//           message:
//             "User registered successfully",

//           user:
//             userWithoutPassword
//         }
//       );

//     } catch (error) {

//       console.error(
//         "Signup error:",
//         error
//       );

//       return sendResponse(
//         500,
//         {

//           message:
//             "Internal server error",

//           error:
//             error.message
//         }
//       );
//     }
// };
















































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { DynamoDBDocumentClient, PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
// import bcrypt from "bcryptjs";

// // ✅ DB setup
// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);

// const TABLE_NAME = "rcs_admin_and_users";

// // ✅ Response helper
// const sendResponse = (statusCode, body) => {
//   return {
//     statusCode,
//     headers: {
//       "Content-Type": "application/json"
//     },
//     body: JSON.stringify(body)
//   };
// };

// // ✅ Email validation
// const isValidEmail = (email) => {
//   const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   return regex.test(email);
// };

// // ✅ Indian mobile validation
// const isValidIndianMobileNumber = (phone) => {
//   return /^[6-9]\d{9}$/.test(phone);
// };

// export const handler = async (event) => {
//   try {
//     // ✅ Parse request body (IMPORTANT FIX)
//     //const body = event.body;

//     let { email, username, password, phone,role } = event;

//     // ✅ 1. Required fields
//     if (!email || !username || !password || !phone) {
//       return sendResponse(400, {
//         message: "email, username, password, phone are required"
//       });
//     }

//     // ✅ 2. Normalize
//     email = email.toLowerCase();
//     username = username.toLowerCase();

//     // ✅ 3. Validate
//     if (!isValidEmail(email)) {
//       return sendResponse(400, { message: "Invalid email format" });
//     }

//     if (!isValidIndianMobileNumber(phone)) {
//       return sendResponse(400, { message: "Invalid phone number" });
//     }

//     // ✅ 4. Check duplicate email (PK)
//     const existingUser = await docClient.send(
//       new GetCommand({
//         TableName: TABLE_NAME,
//         Key: { id: email }
//       })
//     );

//     if (existingUser.Item) {
//       return sendResponse(409, {
//         message: "Email already registered"
//       });
//     }

//     // ✅ 5. Hash password
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     const timestamp = new Date().toISOString();

//     // ✅ 6. Create user object
//     const userToSave = {
//       id: email,            
      
//       username,
//       phone,

//       password: hashedPassword,

//       role,         
//       createdBy: "system",  

//       createdAt: timestamp,
//       updatedAt: timestamp,

//       status: "active"
      
//     };

//     // ✅ 7. Save in DB
//     await docClient.send(
//       new PutCommand({
//         TableName: TABLE_NAME,
//         Item: userToSave
//       })
//     );

//     // ✅ 8. Remove password from response
//     const { password: _, ...userWithoutPassword } = userToSave;

//     return sendResponse(201, {
//       message: "User registered successfully",
//       user: userWithoutPassword
//     });

//   } catch (error) {
//     console.error("Signup error:", error);

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message 
//     });
//   }
// };