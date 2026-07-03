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
      creditedBy,
      creditedTo,
     // creditType,
      amount,
      remark
    } = body;

    // ======================
    // Validations
    // ======================

    if (
      !creditedBy ||
      !creditedTo ||
     // !creditType ||
      !amount
    ) {
      return sendResponse(400, {
        message:
          "creditedBy, creditedTo,  and amount are required"
      });
    }

    creditedBy = creditedBy.toLowerCase();

    creditedTo = creditedTo.toLowerCase();

    amount = Number(amount);

    if (amount <= 0) {
      return sendResponse(400, {
        message: "amount must be greater than 0"
      });
    }

    // // ======================
    // // Validate Credit Type
    // // ======================

    // const validCreditTypes = [
    //   "textCredit",
    //   "richCredit"
    // ];

    // if (
    //   !validCreditTypes.includes(creditType)
    // ) {
    //   return sendResponse(400, {
    //     message:
    //       "creditType must be textCredit or richCredit"
    //   });
    // }

    // ======================
    // Fetch Sender
    // ======================

    const senderResponse =
      await ddbDocClient.send(
        new GetCommand({
          TableName: USERS_TABLE,
          Key: {
            id: creditedBy
          }
        })
      );

    const sender = senderResponse.Item;

    if (!sender) {
      return sendResponse(404, {
        message: "Sender not found"
      });
    }

    // ======================
    // Fetch Receiver
    // ======================

    const receiverResponse =
      await ddbDocClient.send(
        new GetCommand({
          TableName: USERS_TABLE,
          Key: {
            id: creditedTo
          }
        })
      );

    const receiver = receiverResponse.Item;

    if (!receiver) {
      return sendResponse(404, {
        message: "Receiver not found"
      });
    }

    // ======================
    // Balance Field
    // ======================

    const balanceField =
    "walletBalance";

    // ======================
    // Sender Current Balance
    // ======================

    const senderBalance =
      Number(sender[balanceField] || 0);

    // ======================
    // Check Balance
    // ======================

    if (senderBalance < amount) {
      return sendResponse(400, {
        message: `Insufficient wallet balance`
      });
    }

    // ======================
    // Receiver Current Balance
    // ======================

    const receiverBalance =
      Number(receiver[balanceField] || 0);

    // ======================
    // New Balances
    // ======================

    const senderUpdatedBalance =
      senderBalance - amount;

    const receiverUpdatedBalance =
      receiverBalance + amount;

    // ======================
    // Update Sender Balance
    // ======================

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,

        Key: {
          id: creditedBy
        },

        UpdateExpression: `
          SET
          ${balanceField} = :balance,
          updatedAt = :updatedAt
        `,

        ExpressionAttributeValues: {
          ":balance": senderUpdatedBalance,
          ":updatedAt":
            new Date().toISOString()
        }
      })
    );

    // ======================
    // Update Receiver Balance
    // ======================

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,

        Key: {
          id: creditedTo
        },

        UpdateExpression: `
          SET
          ${balanceField} = :balance,
          updatedAt = :updatedAt
        `,

        ExpressionAttributeValues: {
          ":balance": receiverUpdatedBalance,
          ":updatedAt":
            new Date().toISOString()
        }
      })
    );

    // ======================
    // Transaction Time
    // ======================

    // const createdAt =
    //   new Date().toISOString();
// ======================
// DATE TIME MONTH
// ======================

const now =
  new Date();

const createdAt =
  now.toISOString();

const currentDate =
  now.toLocaleDateString(
    "en-GB"
  );

const currentTime =
  now.toLocaleTimeString(
    "en-IN",
    {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    }
  );

const currentMonth =
  now.toLocaleString(
    "en-US",
    {
      month: "long"
    }
  );

const currentYear =
  now.getFullYear();
    // ======================
    // Sender Transaction
    // ======================

    await ddbDocClient.send(
      new PutCommand({
        TableName: TRANSACTION_TABLE,

        Item: {
          id: `TXN_${Date.now()}_DEBIT`,

          email: creditedBy,

          type: "debit",

          transactionType:
            "seller_to_client",

          

          amount,

          

          previousBalance: senderBalance,

          currentBalance:
            senderUpdatedBalance,

          creditedBy,

          creditedTo,

          remark:
            remark ||
            "Credit transferred",

          status: "success",

          createdAt,

          currentDate,

           currentTime,

           currentMonth,

           currentYear
        }
      })
    );

    // ======================
    // Receiver Transaction
    // ======================

    await ddbDocClient.send(
      new PutCommand({
        TableName: TRANSACTION_TABLE,

        Item: {
          id: `TXN_${Date.now()}_CREDIT`,

          email: creditedTo,

          type: "credit",

          transactionType:
            "seller_to_client",

        

          previousBalance:
            receiverBalance,

          currentBalance:
            receiverUpdatedBalance,

          creditedBy,

          creditedTo,

          remark:
            remark ||
            "Credit received",

          status: "success",

          createdAt,

          currentDate,

         currentTime,

          currentMonth,

           currentYear
        }
      })
    );

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message:
        "Credit transferred successfully",

      data: {
        creditedBy,
        creditedTo,
       
        amount,

        senderUpdatedBalance,

        receiverUpdatedBalance
      }
    });

  } catch (error) {

    console.error(
      "Add Credit Error:",
      error
    );

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }

};