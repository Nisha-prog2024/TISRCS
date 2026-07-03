import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DB Setup
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_bots";

// ======================
// Response Helper
// ======================

const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

// ======================
// Update Bot Status API
// ======================

export const handler = async (event) => {
  try {

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event;

    let { botId, status } = body;

    // ======================
    // Validation
    // ======================

    if (!botId || !status) {
      return sendResponse(400, {
        message:
          "botId and status are required"
      });
    }

    status = status.toLowerCase();

    // ======================
    // Allowed Status
    // ======================

    const allowedStatus = [
      "launched",
      "disapproved"
    ];

    if (!allowedStatus.includes(status)) {
      return sendResponse(400, {
        message:
          "status must be launched or disapproved"
      });
    }

    // ======================
    // Check Bot Exists
    // ======================

    const existingBot =
      await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            id: botId
          }
        })
      );

    if (!existingBot.Item) {
      return sendResponse(404, {
        message: "Bot not found"
      });
    }

    // ======================
    // Allow Update Only If
    // Current Status Is
    // active OR disapproved
    // ======================

    const currentStatus =
      existingBot.Item.status?.toLowerCase();

    if (
      currentStatus !== "active" &&
      currentStatus !== "disapproved"&&
  currentStatus !== "launched"
    ) {
      return sendResponse(400, {
        message:
          "Only bots with status active or launched or  disapproved can be updated"
      });
    }

    // ======================
    // Update Status
    // ======================

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,

        Key: {
          id: botId
        },

        UpdateExpression:
          "set #status = :status",

        ExpressionAttributeNames: {
          "#status": "status"
        },

        ExpressionAttributeValues: {
          ":status": status
        },

        ReturnValues: "ALL_NEW"
      })
    );

    // ======================
    // Fetch Updated Bot
    // ======================

    const updatedBot =
      await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            id: botId
          }
        })
      );

    return sendResponse(200, {
      message:
        "Bot status updated successfully",
      bot: updatedBot.Item
    });

  } catch (error) {

    console.error(
      "Update Bot Status Error:",
      error
    );

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};















































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// import {
//   DynamoDBDocumentClient,
//   UpdateCommand,
//   GetCommand
// } from "@aws-sdk/lib-dynamodb";

// // ======================
// // DB Setup
// // ======================

// const client = new DynamoDBClient({
//   region: "ap-south-1"
// });

// const docClient =
//   DynamoDBDocumentClient.from(client);

// const TABLE_NAME = "rcs_bots";

// // ======================
// // Response Helper
// // ======================

// const sendResponse = (statusCode, body) => ({
//   statusCode,
//   headers: {
//     "Content-Type": "application/json"
//   },
//   body: JSON.stringify(body)
// });

// // ======================
// // Update Bot Status API
// // ======================

// export const handler = async (event) => {
//   try {

//     const body =
//       typeof event.body === "string"
//         ? JSON.parse(event.body)
//         : event;

//     let { botId, status } = body;

//     // ======================
//     // Validation
//     // ======================

//     if (!botId || !status) {
//       return sendResponse(400, {
//         message:
//           "botId and status are required"
//       });
//     }

//     status = status.toLowerCase();

//     // ======================
//     // Allowed Status
//     // ======================

//     const allowedStatus = [
//       "launched",
//       "disapproved"
//     ];

//     if (!allowedStatus.includes(status)) {
//       return sendResponse(400, {
//         message:
//           "status must be launched or disapproved"
//       });
//     }

//     // ======================
//     // Check Bot Exists
//     // ======================

//     const existingBot =
//       await docClient.send(
//         new GetCommand({
//           TableName: TABLE_NAME,
//           Key: {
//             id: botId
//           }
//         })
//       );

//     if (!existingBot.Item) {
//       return sendResponse(404, {
//         message: "Bot not found"
//       });
//     }

//     // ======================
//     // Update Status
//     // ======================

//     await docClient.send(
//       new UpdateCommand({
//         TableName: TABLE_NAME,

//         Key: {
//           id: botId
//         },

//         UpdateExpression:
//           "set #status = :status",

//         ExpressionAttributeNames: {
//           "#status": "status"
//         },

//         ExpressionAttributeValues: {
//           ":status": status
//         },

//         ReturnValues: "ALL_NEW"
//       })
//     );

//     // ======================
//     // Fetch Updated Bot
//     // ======================

//     const updatedBot =
//       await docClient.send(
//         new GetCommand({
//           TableName: TABLE_NAME,
//           Key: {
//             id: botId
//           }
//         })
//       );

//     return sendResponse(200, {
//       message:
//         "Bot status updated successfully",
//       bot: updatedBot.Item
//     });

//   } catch (error) {

//     console.error(
//       "Update Bot Status Error:",
//       error
//     );

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });

//   }
// };