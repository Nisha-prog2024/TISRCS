import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

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
// Get All Users API
// Latest users first
// ======================

export const handler =
  async () => {

    try {

      // ======================
      // Fetch All Users
      // ======================

      const result =
        await ddbDocClient.send(

          new ScanCommand({

            TableName:
              TABLE_NAME
          })
        );

      let users =
        result.Items || [];

      // ======================
      // Sort Latest Users First
      // Using createdAt
      // ======================

      users.sort((a, b) => {

        return new Date(
          b.createdAt
        ) - new Date(
          a.createdAt
        );
      });

      // ======================
      // Remove Passwords
      // ======================

      const usersWithoutPassword =
        users.map(user => {

          const {
            password,
            ...rest

          } = user;

          return rest;
        });

      // ======================
      // Success Response
      // ======================

      return sendResponse(
        200,
        {

          message:
            "Users fetched successfully",

          totalUsers:
            usersWithoutPassword.length,

          users:
            usersWithoutPassword
        }
      );

    } catch (error) {

      console.error(
        "Fetch Users Error:",
        error
      );

      return sendResponse(
        500,
        {

          message:
            "Internal server error",

          error:
            error.message
        });
    }
};
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// import {
//   DynamoDBDocumentClient,
//   QueryCommand
// } from "@aws-sdk/lib-dynamodb";

// // ======================
// // DynamoDB Configuration
// // ======================

// const client = new DynamoDBClient({
//   region: "ap-south-1"
// });

// const ddbDocClient =
//   DynamoDBDocumentClient.from(client);

// // ======================
// // Table Name
// // ======================

// const TABLE_NAME =
//   "rcs_admin_and_users";

// // ======================
// // Response Function
// // ======================

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

// // ======================
// // Get Users API
// // Fetch users created by
// // a particular admin
// // Latest users first
// // ======================

// export const handler =
//   async (event) => {

//     try {

//       // ======================
//       // Get createdBy
//       // ======================

//       let {
//         createdBy
//       } = event;

//       // ======================
//       // Validation
//       // ======================

//       if (!createdBy) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "createdBy is required"
//           }
//         );
//       }

//       // normalize
//       createdBy =
//         createdBy.toLowerCase();

//       // ======================
//       // Fetch Users
//       // Using GSI:
//       // createdBy-createdAt-index
//       //
//       // PK  -> createdBy
//       // SK  -> createdAt
//       //
//       // ScanIndexForward:false
//       // gives latest users first
//       // ======================

//       const result =
//         await ddbDocClient.send(

//           new QueryCommand({

//             TableName:
//               TABLE_NAME,

//             IndexName:
//               "createdBy-createdAt-index",

//             KeyConditionExpression:
//               "createdBy = :createdBy",

//             ExpressionAttributeValues: {

//               ":createdBy":
//                 createdBy
//             },

//             // latest first
//             ScanIndexForward:
//               false
//           })
//         );

//       const users =
//         result.Items || [];

//       // ======================
//       // Remove Passwords
//       // ======================

//       const usersWithoutPassword =
//         users.map(user => {

//           const {
//             password,
//             ...rest

//           } = user;

//           return rest;
//         });

//       // ======================
//       // Success Response
//       // ======================

//       return sendResponse(
//         200,
//         {

//           message:
//             "Users fetched successfully",

//           totalUsers:
//             usersWithoutPassword.length,

//           users:
//             usersWithoutPassword
//         }
//       );

//     } catch (error) {

//       console.error(
//         "Fetch Users Error:",
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

// import {
//   DynamoDBDocumentClient,
//   ScanCommand
// } from "@aws-sdk/lib-dynamodb";

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
// // Get All Users API
// // ======================

// export const handler = async () => {
//   try {

//     // ======================
//     // Fetch All Users
//     // ======================

//     const result = await ddbDocClient.send(
//       new ScanCommand({
//         TableName: TABLE_NAME
//       })
//     );

//     const users = result.Items || [];

//     // ======================
//     // Remove Passwords
//     // ======================

//     const usersWithoutPassword = users.map(user => {
//       const { password, ...rest } = user;
//       return rest;
//     });

//     // ======================
//     // Success Response
//     // ======================

//     return sendResponse(200, {
//       message: "Users fetched successfully",
//       totalUsers: usersWithoutPassword.length,
//       users: usersWithoutPassword
//     });

//   } catch (error) {

//     console.error("Fetch Users Error:", error);

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });

//   }
// };