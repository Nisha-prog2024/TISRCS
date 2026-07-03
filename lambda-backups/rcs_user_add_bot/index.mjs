import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

import crypto from "crypto";

// ✅ DB setup
const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_bots";
const BOT_NAME_INDEX = "botName-index";
//const BRAND_INDEX = "brand-index";

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

// ✅ Generate botId
const generateBotId = () => {

  return (
    "bot_" +
    crypto
      .randomBytes(6)
      .toString("hex")
  );

};

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

  // Indian mobile number validation
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
      email,
      //username,
      brand,
      botName,
      region,
      status,
      botType,
      botBillingCategory,
      botLogo,
      bannerImage,
      description,
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

    // ✅ Required fields
    if (
      !email ||
      !botName ||
      !brand||
      !phone
    ) {

      return sendResponse(
        400,
        {
          message:
            "email,phone,brand and botName are required"
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
    // ✅ Duplicate bot name check
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

    if (
      existingBot.Items &&
      existingBot.Items.length >
        0
    ) {

      return sendResponse(
        400,
        {
          message:
            "Bot name already exists"
        }
      );

    }
// ✅ Duplicate brand check

// if (normalizedBrand) {

//   const existingBrand =
//     await docClient.send(
//       new QueryCommand({
//         TableName:
//           TABLE_NAME,

//         IndexName:
//           BRAND_INDEX,

//         KeyConditionExpression:
//           "brand = :brand",

//         ExpressionAttributeValues:
//           {
//             ":brand":
//               normalizedBrand
//           }
//       })
//     );

//   if (
//     existingBrand.Items &&
//     existingBrand.Items.length > 0
//   ) {

//     return sendResponse(
//       400,
//       {
//         message:
//           "Brand already exists"
//       }
//     );

//   }

// }
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
        : "";

    // ✅ Generate bot ID
    const botId =
      generateBotId();

    const now =
      new Date();

    const timestamp =
      now.toISOString();

    const date =
      now.toLocaleDateString(
        "en-GB"
      );

    const time =
      now.toLocaleTimeString(
        "en-US"
      );

    const year =
      now.getFullYear();

    // ✅ Final bot object

    const botData = {

      id: botId,

      email:
        normalizedEmail,

      // username:
      //   username
      //     ?.toLowerCase()
      //     ?.trim(),

      botName:
        normalizedBotName,

      region:
        region
          ?.toLowerCase()
          ?.trim(),

      status:
        status
          ?.toLowerCase()
          ?.trim(),

      botLogo:
        botLogo || "",

      bannerImage:
        bannerImage || "",

      botType:
        botType
          ?.toLowerCase()
          ?.trim(),

      botBillingCategory:
        botBillingCategory
          ?.toLowerCase()
          ?.trim(),

      description:
        description
          ?.toLowerCase()
          ?.trim(),
          brand:
          normalizedBrand || "",
      phone:
        normalizedPhone,

      labelForPhone:
        labelForPhone
          ?.toLowerCase()
          ?.trim(),

      primaryEmailId:
        normalizedPrimaryEmail,

      labelForPrimaryEmailId:
        labelForPrimaryEmailId
          ?.toLowerCase()
          ?.trim(),

      primaryWebsite,

      labelForPrimaryWebsite:
        labelForPrimaryWebsite
          ?.toLowerCase()
          ?.trim(),

      termsOfUseURL,

      privacyPolicyURL,

      languagesSupported:
        languagesSupported?.map(
          (
            language
          ) =>
            language
              ?.toLowerCase()
              ?.trim()
        ) || [],

      createdAt:
        timestamp,

      date,
      time,
      year
    };

    // ✅ Save bot

    await docClient.send(
      new PutCommand({
        TableName:
          TABLE_NAME,

        Item: botData
      })
    );

    return sendResponse(
      201,
      {
        message:
          "Bot created successfully",

        botId,

        bot: botData
      }
    );

  } catch (error) {

    console.error(
      "Create bot error:",
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
// import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
// import crypto from "crypto";

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

// // ✅ Generate botId
// const generateBotId = () => {
//   return "bot_" + crypto.randomBytes(2).toString("hex");
// };

// export const handler = async (event) => {
//   try {
//     const body = event;

//     const {
//       email,
//       username,
//       botName,
//       region,
//       status,
//       botMessageType,
//       botBillingCategory,
//       botLogo,
//       bannerImage,
//       description,
//       phone,
//       labelForPhone,
//       primaryEmailId,
//       labelForPrimaryEmailId,
//       primaryWebsite,
//       labelForPrimaryWebsite,
//       termsOfUseURL,
//       privacyPolicyURL,
//       languagesSupported
//     } = body;

//     // ✅ Required fields
//     if (!email || !botName) {
//       return sendResponse(400, {
//         message: "email and botName are required"
//       });
//     }

//     const botId = generateBotId();

//     const now = new Date();

//     const timestamp = now.toISOString();
//     const date = now.toLocaleDateString("en-GB"); // dd/mm/yyyy
//     const time = now.toLocaleTimeString("en-US");
//     const year = now.getFullYear();

//     // ✅ Bot object
//     const botData = {
//         id: botId,
      
//         email: email?.toLowerCase(),
//         username: username?.toLowerCase(),
//         botName: botName?.toLowerCase(),
      
//         region: region?.toLowerCase(),
//         status: status?.toLowerCase(),
//         botLogo:botLogo||"",
//         bannerImage:bannerImage||"",
//         botMessageType: botMessageType?.toLowerCase(),
//         botBillingCategory: botBillingCategory?.toLowerCase(),
      
//         description: description?.toLowerCase(),
      
//         phone,
//         labelForPhone:labelForPhone?.toLowerCase(),
      
//         primaryEmailId: primaryEmailId,
//         labelForPrimaryEmailId,
      
//         primaryWebsite,
//         labelForPrimaryWebsite,
      
//         termsOfUseURL,
//         privacyPolicyURL,
      
//         languagesSupported: languagesSupported?.map(l => l.toLowerCase()),
      
//         createdAt: timestamp,
//         date,
//         time,
//         year
//       };

//     // ✅ Save in DB
//     await docClient.send(
//       new PutCommand({
//         TableName: TABLE_NAME,
//         Item: botData
//       })
//     );

//     return sendResponse(201, {
//       message: "Bot created successfully",
//       botId,
//       bot: botData
//     });

//   } catch (error) {
//     console.error("Create bot error:", error);

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });
//   }
// };