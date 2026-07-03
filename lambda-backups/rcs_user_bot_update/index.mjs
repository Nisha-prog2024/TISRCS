import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

// ✅ DB setup
const client = new DynamoDBClient({});

const docClient =
  DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_bots";
const BOT_NAME_INDEX = "botName-index";
const BRAND_INDEX = "brand-index";

// ✅ Response helper
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

// ✅ URL validation
const isValidURL = (url) => {

  try {

    const parsedUrl =
      new URL(url);

    return (
      parsedUrl.protocol ===
        "http:" ||
      parsedUrl.protocol ===
        "https:"
    );

  } catch (error) {

    return false;

  }

};

// ✅ Email validation
const isValidEmail = (
  email
) => {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );

};

// ✅ Normalize Indian phone
const normalizeIndianPhone = (
  phone
) => {

  let cleanedPhone =
    phone.replace(/\D/g, "");

  // remove 91 country code
  if (
    cleanedPhone.length ===
      12 &&
    cleanedPhone.startsWith(
      "91"
    )
  ) {

    cleanedPhone =
      cleanedPhone.slice(2);

  }

  return cleanedPhone;

};

// ✅ Indian mobile validation
const isValidPhone = (
  phone
) => {

  const normalizedPhone =
    normalizeIndianPhone(
      phone
    );

  return /^[6-9][0-9]{9}$/.test(
    normalizedPhone
  );

};

export const handler = async (
  event
) => {

  try {

    const body = event;

    const {
      botId,
      email,
      username,
      botName,
      region,
      status,
      botType,
      botBillingCategory,
      botLogo,
      bannerImage,
      description,
      brand,
      phone,
      labelForPhone,
      primaryEmailId,
      labelForPrimaryEmailId,
      primaryWebsite,
      labelForPrimaryWebsite,
      termsOfUseURL,
      privacyPolicyURL,
      languagesSupported
    } = body;

    // ✅ Required field
    if (!botId) {

      return sendResponse(
        400,
        {
          message:
            "botId is required"
        }
      );

    }

    // ✅ Check bot exists
    const existingBotData =
      await docClient.send(
        new GetCommand({
          TableName:
            TABLE_NAME,
          Key: { id:botId }
        })
      );

    if (
      !existingBotData.Item
    ) {

      return sendResponse(
        404,
        {
          message:
            "Bot not found"
        }
      );

    }

    // ✅ Normalize values
    const normalizedBotName =
      botName
        ?.toLowerCase()
        ?.trim();

    const normalizedEmail =
      email
        ?.toLowerCase()
        ?.trim();

    const normalizedPrimaryEmail =
      primaryEmailId
        ?.toLowerCase()
        ?.trim();

    const normalizedBrand =
        brand
          ?.toLowerCase()
          ?.trim();
    // ✅ Duplicate bot name validation
    if (normalizedBotName) {

      const existingBot =
        await docClient.send(
          new QueryCommand({
            TableName:
              TABLE_NAME,

            IndexName:
              BOT_NAME_INDEX,

            KeyConditionExpression:
              "botName = :botName",

            ExpressionAttributeValues:
              {
                ":botName":
                  normalizedBotName
              }
          })
        );

      const duplicateBot =
        existingBot.Items?.find(
          (item) =>
            item.id !== botId
        );

      if (duplicateBot) {

        return sendResponse(
          400,
          {
            message:
              "Bot name already exists"
          }
        );

      }

    }
//     // ✅ Duplicate brand validation
// if (normalizedBrand) {

//   const existingBrand =
//     await docClient.send(
//       new QueryCommand({
//         TableName:
//           TABLE_NAME,

        // IndexName:
        //   BRAND_INDEX,

  //       KeyConditionExpression:
  //         "brand = :brand",

        // ExpressionAttributeValues:
        //   {
        //     ":brand":
        //       normalizedBrand
        //   }
      // })
    // );

//   const duplicateBrand =
//     existingBrand.Items?.find(
//       (item) =>
//         item.id !== botId
//     );

//   if (duplicateBrand) {

//     return sendResponse(
//       400,
//       {
//         message:
//           "Brand already exists"
//       }
//     );

// }  
//}

    // ✅ Email validation

    if (
      normalizedEmail &&
      !isValidEmail(
        normalizedEmail
      )
    ) {

      return sendResponse(
        400,
        {
          message:
            "Invalid email address"
        }
      );

    }

    if (
      normalizedPrimaryEmail &&
      !isValidEmail(
        normalizedPrimaryEmail
      )
    ) {

      return sendResponse(
        400,
        {
          message:
            "Invalid primaryEmailId"
        }
      );

    }

    // ✅ URL validation

    if (
      primaryWebsite &&
      !isValidURL(
        primaryWebsite
      )
    ) {

      return sendResponse(
        400,
        {
          message:
            "Invalid primaryWebsite URL"
        }
      );

    }

    if (
      termsOfUseURL &&
      !isValidURL(
        termsOfUseURL
      )
    ) {

      return sendResponse(
        400,
        {
          message:
            "Invalid termsOfUseURL"
        }
      );

    }

    if (
      privacyPolicyURL &&
      !isValidURL(
        privacyPolicyURL
      )
    ) {

      return sendResponse(
        400,
        {
          message:
            "Invalid privacyPolicyURL"
        }
      );

    }

    // ✅ Phone validation

    if (
      phone &&
      !isValidPhone(
        phone
      )
    ) {

      return sendResponse(
        400,
        {
          message:
            "Invalid phone number. Enter a valid Indian mobile number"
        }
      );

    }

    // ✅ Normalize phone
    const normalizedPhone =
      phone
        ? normalizeIndianPhone(
            phone
          )
        : undefined;

    const now =
      new Date();

    const updatedAt =
      now.toISOString();

    // ✅ Dynamic update builder

    let updateExpression =
      "SET updatedAt = :updatedAt";

    const expressionAttributeValues =
      {
        ":updatedAt":
          updatedAt
      };

    const expressionAttributeNames =
      {};

    // ✅ Helper function

   // ✅ Helper function
// Handles DynamoDB reserved keywords

const addField = (
  field,
  value
) => {

  const reservedFields = [
    "status",
    "region"
  ];

  if (
    reservedFields.includes(
      field
    )
  ) {

    updateExpression +=
      `, #${field} = :${field}`;

    expressionAttributeNames[
      `#${field}`
    ] = field;

  } else {

    updateExpression +=
      `, ${field} = :${field}`;

  }

  expressionAttributeValues[
    `:${field}`
  ] = value;

};

    // ✅ Add only provided fields

    if (
      normalizedEmail !==
      undefined
    ) {
      addField(
        "email",
        normalizedEmail
      );
    }

    if (
      username !== undefined
    ) {
      addField(
        "username",
        username
          ?.toLowerCase()
          ?.trim()
      );
    }

    if (
      normalizedBotName !==
      undefined
    ) {
      addField(
        "botName",
        normalizedBotName
      );
    }

    if (
      region !== undefined
    ) {
      addField(
        "region",
        region
          ?.toLowerCase()
          ?.trim()
      );
    }
    
    if (
      status !== undefined
    ) {
      addField(
        "status",
        status
          ?.toLowerCase()
          ?.trim()
      );
    }

    if (
      botType !==
      undefined
    ) {
      addField(
        "botType",
        botType
          ?.toLowerCase()
          ?.trim()
      );
    }

    if (
      botBillingCategory !==
      undefined
    ) {
      addField(
        "botBillingCategory",
        botBillingCategory
          ?.toLowerCase()
          ?.trim()
      );
    }

    if (
      botLogo !== undefined
    ) {
      addField(
        "botLogo",
        botLogo
      );
    }

    if (
      bannerImage !==
      undefined
    ) {
      addField(
        "bannerImage",
        bannerImage
      );
    }

    if (
      description !==
      undefined
    ) {
      addField(
        "description",
        description
          ?.toLowerCase()
          ?.trim()
      );
    }
    if (
      normalizedBrand !==
      undefined
    ) {
      addField(
        "brand",
        normalizedBrand
      );
    }
    if (
      normalizedPhone !==
      undefined
    ) {
      addField(
        "phone",
        normalizedPhone
      );
    }

    if (
      labelForPhone !==
      undefined
    ) {
      addField(
        "labelForPhone",
        labelForPhone
          ?.toLowerCase()
          ?.trim()
      );
    }


    if (
      normalizedPrimaryEmail !==
      undefined
    ) {
      addField(
        "primaryEmailId",
        normalizedPrimaryEmail
      );
    }

    if (
      labelForPrimaryEmailId !==
      undefined
    ) {
      addField(
        "labelForPrimaryEmailId",
        labelForPrimaryEmailId
          ?.toLowerCase()
          ?.trim()
      );
    }

    if (
      primaryWebsite !==
      undefined
    ) {
      addField(
        "primaryWebsite",
        primaryWebsite
      );
    }

    if (
      labelForPrimaryWebsite !==
      undefined
    ) {
      addField(
        "labelForPrimaryWebsite",
        labelForPrimaryWebsite
          ?.toLowerCase()
          ?.trim()
      );
    }

    if (
      termsOfUseURL !==
      undefined
    ) {
      addField(
        "termsOfUseURL",
        termsOfUseURL
      );
    }

    if (
      privacyPolicyURL !==
      undefined
    ) {
      addField(
        "privacyPolicyURL",
        privacyPolicyURL
      );
    }

    if (
      languagesSupported !==
      undefined
    ) {
      addField(
        "languagesSupported",
        languagesSupported?.map(
          (
            language
          ) =>
            language
              ?.toLowerCase()
              ?.trim()
        )
      );
    }

    // ✅ Update bot

    const updatedBot =
      await docClient.send(
        new UpdateCommand({
          TableName:
            TABLE_NAME,

          Key: { id:botId },

          UpdateExpression:
            updateExpression,

          ExpressionAttributeValues:
            expressionAttributeValues,

          ExpressionAttributeNames:
            Object.keys(
              expressionAttributeNames
            ).length > 0
              ? expressionAttributeNames
              : undefined,

          ReturnValues:
            "ALL_NEW"
        })
      );

    return sendResponse(
      200,
      {
        message:
          "Bot updated successfully",

        bot:
          updatedBot.Attributes
      }
    );

  } catch (error) {

    console.error(
      "Update bot error:",
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
// import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

// // ✅ DB setup
// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);

// const TABLE_NAME = "rcs_bots";

// // ✅ Response helper
// const sendResponse = (statusCode, body) => ({
//   statusCode,
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify(body)
// });

// export const handler = async (event) => {
//   try {
   

//     const { botId, ...fieldsToUpdate } = event;

//     // ✅ Validate botId
//     if (!botId || typeof botId !== "string") {
//       return sendResponse(400, {
//         message: "Valid botId is required"
//       });
//     }

//     //  No fields to update
//     if (Object.keys(fieldsToUpdate).length === 0) {
//       return sendResponse(400, {
//         message: "At least one field is required to update"
//       });
//     }

//     // Fields to lowercase
//     const LOWERCASE_FIELDS = [
//       "email",
//       "username",
//       "botName",
//       "region",
//       "status",
//       "botMessageType",
//       "botBillingCategory",
//       "description",
//       "primaryEmailId"
//     ];

//     //  Restricted fields (cannot update)
//     const RESTRICTED_FIELDS = ["id", "createdAt"];

//     let updateExpression = "SET ";
//     const expressionAttributeNames = {};
//     const expressionAttributeValues = {};

//     let index = 0;

//     // Build dynamic update expression
//     for (const key in fieldsToUpdate) {
//       if (
//         fieldsToUpdate[key] !== undefined &&
//         !RESTRICTED_FIELDS.includes(key)
//       ) {
//         let value = fieldsToUpdate[key];

//         //  Lowercase selected fields
//         if (LOWERCASE_FIELDS.includes(key) && typeof value === "string") {
//           value = value.toLowerCase();
//         }

//         if (key === "languagesSupported" && Array.isArray(value)) {
//           value = value.map(v =>
//             typeof v === "string" ? v.toLowerCase() : v
//           );
//         }

//         updateExpression += `#key${index} = :value${index}, `;
//         expressionAttributeNames[`#key${index}`] = key;
//         expressionAttributeValues[`:value${index}`] = value;

//         index++;
//       }
//     }

    
//     if (index === 0) {
//       return sendResponse(400, {
//         message: "No valid fields to update"
//       });
//     }

//     // ✅ Remove trailing comma
//     updateExpression = updateExpression.slice(0, -2);

//     // ✅ Add updatedAt
//     updateExpression += ", updatedAt = :updatedAt";
//     expressionAttributeValues[":updatedAt"] = new Date().toISOString();

//     // ✅ Update in DB
//     const result = await docClient.send(
//       new UpdateCommand({
//         TableName: TABLE_NAME,
//         Key: { id: botId },
//         UpdateExpression: updateExpression,
//         ExpressionAttributeNames: expressionAttributeNames,
//         ExpressionAttributeValues: expressionAttributeValues,
//         ReturnValues: "ALL_NEW"
//       })
//     );

//     return sendResponse(200, {
//       message: "Bot updated successfully",
//       updatedBot: result.Attributes
//     });

//   } catch (error) {
//     console.error("Update bot error:", error);

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });
//   }
// };