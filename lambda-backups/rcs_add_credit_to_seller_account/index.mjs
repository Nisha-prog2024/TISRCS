import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DynamoDB Config
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const ddbDocClient = DynamoDBDocumentClient.from(client);

// ======================
// Table Names
// ======================

const USERS_TABLE = "rcs_admin_and_users";

const TRANSACTION_TABLE = "rcs_credit";

// ======================
// Common Response
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
// Lambda Handler
// ======================

export const handler = async (event) => {

  try {

    // ======================
    // Parse Request Body
    // ======================

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event;

    let {
      sellerEmail,
      amount,
      billingPlan,
      remark
    } = body;

    // ======================
    // Validations
    // ======================

    if (
      !sellerEmail ||
      !amount
    ) {
      return sendResponse(400, {
        message:
          "sellerEmail and amount are required"
      });
    }

    sellerEmail =
      sellerEmail.toLowerCase();

    amount = Number(amount);

    if (amount <= 0) {
      return sendResponse(400, {
        message:
          "amount must be greater than 0"
      });
    }

    // ======================
    // Fetch Seller
    // ======================

    const sellerResponse =
      await ddbDocClient.send(
        new GetCommand({
          TableName: USERS_TABLE,
          Key: {
            id: sellerEmail
          }
        })
      );

    const seller = sellerResponse.Item;

    if (!seller) {
      return sendResponse(404, {
        message: "Seller not found"
      });
    }

    // ======================
    // Validate Seller Role
    // ======================

    if (
      seller.userType !== "seller"
    ) {
      return sendResponse(400, {
        message:
          "Selected user is not a seller"
      });
    }

    // ======================
    // Wallet Balance Field
    // ======================

    const balanceField =
      "walletBalance";

    // ======================
    // Current Balance
    // ======================

    const previousBalance =
      Number(
        seller[balanceField] || 0
      );

    // ======================
    // Updated Balance
    // ======================

    const updatedBalance =
      previousBalance + amount;

    // ======================
    // Current Timestamp
    // ======================

    const updatedAt =
      new Date().toISOString();

    // ======================
    // Update Seller Wallet
    // ======================

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,

        Key: {
          id: sellerEmail
        },

        UpdateExpression: `
          SET
          walletBalance = :updatedBalance,
          billingPlan = :billingPlan,
          updatedAt = :updatedAt
        `,

        ExpressionAttributeValues: {
          ":updatedBalance":
            updatedBalance,

          ":billingPlan":
            billingPlan || "",

          ":updatedAt":
            updatedAt
        }
      })
    );

    // ======================
    // Save Transaction History
    // ======================

    const transactionId =
      `TXN_${Date.now()}`;

    await ddbDocClient.send(
      new PutCommand({
        TableName:
          TRANSACTION_TABLE,

        Item: {
          id: transactionId,

          email: sellerEmail,

          userType: "seller",

          type: "credit",

          transactionType:
            "platform_credit",

          amount,

          previousBalance,

          currentBalance:
            updatedBalance,

          creditedBy: "admin",

          creditedTo:
            sellerEmail,

          billingPlan:
            billingPlan || "",

          remark:
            remark ||
            "Wallet balance added",

          status: "success",

          createdAt:
            updatedAt
        }
      })
    );

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message:
        "Wallet balance added successfully",

      data: {
        sellerEmail,

        amount,

        previousBalance,

        updatedBalance,

        billingPlan
      }
    });

  } catch (error) {

    console.error(
      "Add Seller Credit Error:",
      error
    );

    return sendResponse(500, {
      message:
        "Internal server error",

      error: error.message
    });

  }

};































































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// import {
//   DynamoDBDocumentClient,
//   GetCommand,
//   UpdateCommand,
//   PutCommand
// } from "@aws-sdk/lib-dynamodb";

// // ======================
// // DynamoDB Config
// // ======================

// const client = new DynamoDBClient({
//   region: "ap-south-1"
// });

// const ddbDocClient = DynamoDBDocumentClient.from(client);

// // ======================
// // Table Names
// // ======================

// const USERS_TABLE = "rcs_admin_and_users";

// const TRANSACTION_TABLE = "rcs_credit";

// // ======================
// // Common Response
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
// // Lambda Handler
// // ======================

// export const handler = async (event) => {

//   try {

//     // ======================
//     // Parse Request Body
//     // ======================

//     const body =
//       typeof event.body === "string"
//         ? JSON.parse(event.body)
//         : event;

//     let {
//       sellerEmail,
//       creditType,
//       amount,
//       billingPlan,
//       remark
//     } = body;

//     // ======================
//     // Validations
//     // ======================

//     if (
//       !sellerEmail ||
//       !creditType ||
//       !amount
//     ) {
//       return sendResponse(400, {
//         message:
//           "sellerEmail, creditType and amount are required"
//       });
//     }

//     sellerEmail =
//       sellerEmail.toLowerCase();

//     amount = Number(amount);

//     if (amount <= 0) {
//       return sendResponse(400, {
//         message:
//           "amount must be greater than 0"
//       });
//     }

//     // ======================
//     // Validate Credit Type
//     // ======================

//     const validCreditTypes = [
//       "textCredit",
//       "richCredit"
//     ];

//     if (
//       !validCreditTypes.includes(creditType)
//     ) {
//       return sendResponse(400, {
//         message:
//           "creditType must be textCredit or richCredit"
//       });
//     }

//     // ======================
//     // Fetch Seller
//     // ======================

//     const sellerResponse =
//       await ddbDocClient.send(
//         new GetCommand({
//           TableName: USERS_TABLE,
//           Key: {
//             id: sellerEmail
//           }
//         })
//       );

//     const seller = sellerResponse.Item;

//     if (!seller) {
//       return sendResponse(404, {
//         message: "Seller not found"
//       });
//     }

//     // ======================
//     // Validate Seller Role
//     // ======================

//     if (
//       seller.userType !== "seller"
//     ) {
//       return sendResponse(400, {
//         message:
//           "Selected user is not a seller"
//       });
//     }

//     // ======================
//     // Balance Field
//     // ======================

//     const balanceField =
//       creditType === "textCredit"
//         ? "textCreditBalance"
//         : "richCreditBalance";

//     // ======================
//     // Current Balance
//     // ======================

//     const previousBalance =
//       Number(
//         seller[balanceField] || 0
//       );

//     // ======================
//     // Updated Balance
//     // ======================

//     const updatedBalance =
//       previousBalance + amount;

//     // ======================
//     // Current Timestamp
//     // ======================

//     const updatedAt =
//       new Date().toISOString();

//     // ======================
//     // Update Seller Balance
//     // ======================

//     await ddbDocClient.send(
//       new UpdateCommand({
//         TableName: USERS_TABLE,

//         Key: {
//           id: sellerEmail
//         },

//         UpdateExpression: `
//           SET
//           ${balanceField} = :updatedBalance,
//           billingPlan = :billingPlan,
//           updatedAt = :updatedAt
//         `,

//         ExpressionAttributeValues: {
//           ":updatedBalance":
//             updatedBalance,

//           ":billingPlan":
//             billingPlan || "",

//           ":updatedAt":
//             updatedAt
//         }
//       })
//     );

//     // ======================
//     // Save Transaction History
//     // ======================

//     const transactionId =
//       `TXN_${Date.now()}`;

//     await ddbDocClient.send(
//       new PutCommand({
//         TableName:
//           TRANSACTION_TABLE,

//         Item: {
//           id: transactionId,

//           email: sellerEmail,

//           userType: "seller",

//           type: "credit",

//           transactionType:
//             "platform_credit",

//           creditType,

//           amount,

//           previousBalance,

//           currentBalance:
//             updatedBalance,

//           creditedBy: "admin",

//           creditedTo:
//             sellerEmail,

//           billingPlan:
//             billingPlan || "",

//           remark:
//             remark ||
//             "Wallet balance added",

//           status: "success",

//           createdAt:
//             updatedAt
//         }
//       })
//     );

//     // ======================
//     // Success Response
//     // ======================

//     return sendResponse(200, {
//       message:
//         "Wallet balance added successfully",

//       data: {
//         sellerEmail,

//         creditType,

//         amount,

//         previousBalance,

//         updatedBalance,

//         billingPlan
//       }
//     });

//   } catch (error) {

//     console.error(
//       "Add Seller Credit Error:",
//       error
//     );

//     return sendResponse(500, {
//       message:
//         "Internal server error",

//       error: error.message
//     });

//   }

// };