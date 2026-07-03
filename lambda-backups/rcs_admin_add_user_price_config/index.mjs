import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand
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
// Common Response Function
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

    body: JSON.stringify(body)
  };
};

// ======================
// Lambda Handler
// ======================

export const handler = async (
  event
) => {

  try {

    // ======================
    // Parse Request Body
    // ======================

    const body =
      typeof event.body ===
      "string"
        ? JSON.parse(event.body)
        : event;

    let {
      email,

      smsPrice,
      whatsappPrice,
      rcsPrice,

      smsDeductionType,
      whatsappDeductionType,
      rcsDeductionType,

      smsCreditType,
      whatsappCreditType,
      rcsCreditType,

      autoBillingEnabled
    } = body;

    // ======================
    // Required Validation
    // ======================

    if (!email) {
      return sendResponse(400, {
        message:
          "email is required"
      });
    }

    // ======================
    // Lowercase Email
    // ======================

    email =
      email.toLowerCase();

    // ======================
    // Check User Exists
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

    if (!existingUser.Item) {
      return sendResponse(404, {
        message:
          "User not found"
      });
    }

    // ======================
    // Default Values
    // ======================

    smsPrice = Number(
      smsPrice || 0
    );

    whatsappPrice = Number(
      whatsappPrice || 0
    );

    rcsPrice = Number(
      rcsPrice || 0
    );

    smsDeductionType =
      smsDeductionType?.toLowerCase() ||
      "delivered";

    whatsappDeductionType =
      whatsappDeductionType?.toLowerCase() ||
      "delivered";

    rcsDeductionType =
      rcsDeductionType?.toLowerCase() ||
      "delivered";

    smsCreditType =
      smsCreditType ||
      "textCredit";

    whatsappCreditType =
      whatsappCreditType ||
      "richCredit";

    rcsCreditType =
      rcsCreditType ||
      "richCredit";

    autoBillingEnabled =
      typeof autoBillingEnabled ===
      "boolean"
        ? autoBillingEnabled
        : true;

    // ======================
    // Validate Deduction Types
    // ======================

    const validDeductionTypes =
      [
        "sent",
        "delivered"
      ];

    if (
      !validDeductionTypes.includes(
        smsDeductionType
      )
    ) {
      return sendResponse(400, {
        message:
          "Invalid smsDeductionType. Use sent or delivered"
      });
    }

    if (
      !validDeductionTypes.includes(
        whatsappDeductionType
      )
    ) {
      return sendResponse(400, {
        message:
          "Invalid whatsappDeductionType. Use sent or delivered"
      });
    }

    if (
      !validDeductionTypes.includes(
        rcsDeductionType
      )
    ) {
      return sendResponse(400, {
        message:
          "Invalid rcsDeductionType. Use sent or delivered"
      });
    }

    // ======================
    // Validate Credit Types
    // ======================

    const validCreditTypes =
      [
        "textCredit",
        "richCredit"
      ];

    if (
      !validCreditTypes.includes(
        smsCreditType
      )
    ) {
      return sendResponse(400, {
        message:
          "Invalid smsCreditType"
      });
    }

    if (
      !validCreditTypes.includes(
        whatsappCreditType
      )
    ) {
      return sendResponse(400, {
        message:
          "Invalid whatsappCreditType"
      });
    }

    if (
      !validCreditTypes.includes(
        rcsCreditType
      )
    ) {
      return sendResponse(400, {
        message:
          "Invalid rcsCreditType"
      });
    }

    // ======================
    // Current Timestamp
    // ======================

    const updatedAt =
      new Date().toISOString();

    // ======================
    // Update Pricing Config
    // ======================

    const updatedUser =
      await ddbDocClient.send(
        new UpdateCommand({
          TableName:
            TABLE_NAME,

          Key: {
            id: email
          },

          UpdateExpression: `
            SET
            smsPrice = :smsPrice,
            whatsappPrice = :whatsappPrice,
            rcsPrice = :rcsPrice,

            smsDeductionType = :smsDeductionType,
            whatsappDeductionType = :whatsappDeductionType,
            rcsDeductionType = :rcsDeductionType,

            smsCreditType = :smsCreditType,
            whatsappCreditType = :whatsappCreditType,
            rcsCreditType = :rcsCreditType,

            autoBillingEnabled = :autoBillingEnabled,

            updatedAt = :updatedAt
          `,

          ExpressionAttributeValues:
            {
              ":smsPrice":
                smsPrice,

              ":whatsappPrice":
                whatsappPrice,

              ":rcsPrice":
                rcsPrice,

              ":smsDeductionType":
                smsDeductionType,

              ":whatsappDeductionType":
                whatsappDeductionType,

              ":rcsDeductionType":
                rcsDeductionType,

              ":smsCreditType":
                smsCreditType,

              ":whatsappCreditType":
                whatsappCreditType,

              ":rcsCreditType":
                rcsCreditType,

              ":autoBillingEnabled":
                autoBillingEnabled,

              ":updatedAt":
                updatedAt
            },

          ReturnValues:
            "ALL_NEW"
        })
      );

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message:
        "Pricing configuration updated successfully",

      data:
        updatedUser.Attributes
    });

  } catch (error) {

    console.error(
      "Pricing Configuration Error:",
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





// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// import {
//   DynamoDBDocumentClient,
//   UpdateCommand,
//   GetCommand
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
// // Common Response Function
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
//       email,

//       smsPrice,
//       whatsappPrice,
//       rcsPrice,

//       smsDeductionType,
//       whatsappDeductionType,
//       rcsDeductionType,

//       autoBillingEnabled
//     } = body;

//     // ======================
//     // Required Validation
//     // ======================

//     if (!email) {
//       return sendResponse(400, {
//         message: "email is required"
//       });
//     }

//     // ======================
//     // Lowercase Email
//     // ======================

//     email = email.toLowerCase();

//     // ======================
//     // Check User Exists
//     // ======================

//     const existingUser = await ddbDocClient.send(
//       new GetCommand({
//         TableName: TABLE_NAME,
//         Key: {
//           id: email
//         }
//       })
//     );

//     if (!existingUser.Item) {
//       return sendResponse(404, {
//         message: "User not found"
//       });
//     }

//     // ======================
//     // Default Values
//     // ======================

//     smsPrice = Number(smsPrice || 0);

//     whatsappPrice = Number(whatsappPrice || 0);

//     rcsPrice = Number(rcsPrice || 0);

//     smsDeductionType =
//       smsDeductionType?.toLowerCase() || "delivered";

//     whatsappDeductionType =
//       whatsappDeductionType?.toLowerCase() || "delivered";

//     rcsDeductionType =
//       rcsDeductionType?.toLowerCase() || "delivered";

//     autoBillingEnabled =
//       typeof autoBillingEnabled === "boolean"
//         ? autoBillingEnabled
//         : true;

//     // ======================
//     // Validate Deduction Types
//     // ======================

//     const validDeductionTypes = [
//       "sent",
//       "delivered"
//     ];

//     if (
//       !validDeductionTypes.includes(smsDeductionType)
//     ) {
//       return sendResponse(400, {
//         message:
//           "Invalid smsDeductionType. Use sent or delivered"
//       });
//     }

//     if (
//       !validDeductionTypes.includes(whatsappDeductionType)
//     ) {
//       return sendResponse(400, {
//         message:
//           "Invalid whatsappDeductionType. Use sent or delivered"
//       });
//     }

//     if (
//       !validDeductionTypes.includes(rcsDeductionType)
//     ) {
//       return sendResponse(400, {
//         message:
//           "Invalid rcsDeductionType. Use sent or delivered"
//       });
//     }

//     // ======================
//     // Current Timestamp
//     // ======================

//     const updatedAt = new Date().toISOString();

//     // ======================
//     // Update Pricing Config
//     // ======================

//     const updatedUser = await ddbDocClient.send(
//       new UpdateCommand({
//         TableName: TABLE_NAME,

//         Key: {
//           id: email
//         },

//         UpdateExpression: `
//           SET
//           smsPrice = :smsPrice,
//           whatsappPrice = :whatsappPrice,
//           rcsPrice = :rcsPrice,

//           smsDeductionType = :smsDeductionType,
//           whatsappDeductionType = :whatsappDeductionType,
//           rcsDeductionType = :rcsDeductionType,

//           autoBillingEnabled = :autoBillingEnabled,

//           updatedAt = :updatedAt
//         `,

//         ExpressionAttributeValues: {
//           ":smsPrice": smsPrice,
//           ":whatsappPrice": whatsappPrice,
//           ":rcsPrice": rcsPrice,

//           ":smsDeductionType": smsDeductionType,
//           ":whatsappDeductionType":
//             whatsappDeductionType,
//           ":rcsDeductionType": rcsDeductionType,

//           ":autoBillingEnabled":
//             autoBillingEnabled,

//           ":updatedAt": updatedAt
//         },

//         ReturnValues: "ALL_NEW"
//       })
//     );

//     // ======================
//     // Success Response
//     // ======================

//     return sendResponse(200, {
//       message:
//         "Pricing configuration updated successfully",

//       data: updatedUser.Attributes
//     });

//   } catch (error) {

//     console.error(
//       "Pricing Configuration Error:",
//       error
//     );

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });

//   }

// };