import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
//import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";
import crypto from "crypto";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_templates";
const BOT_TABLE = "rcs_bots";

const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

const generateId = () =>
  "temp_" + crypto.randomBytes(2).toString("hex");

export const handler = async (event) => {
  try {
    const body = event;

    let {
      botId,
      email,
      botName,
      username,
      templateName,
      templateType,
      orientation,
      width,
      mediaHeight,
      cardUrl,
      cardTitle,
      cardDescription,
      suggestions = []
    } = body;

    // ✅ Required fields
    if (!botId || !email || !templateName || !templateType) {
      return sendResponse(400, {
        message: "botId, email, templateName, templateType are required"
      });
    }
    // ====================================
// FETCH BOT DETAILS USING botId
// ====================================

const botData = await docClient.send(
  new GetCommand({
    TableName: BOT_TABLE,
    Key: {
      id: botId
    }
  })
);

if (!botData.Item) {
  return sendResponse(404, {
    message: "Bot not found"
  });
}

const botDetails = botData.Item;

    // ✅ Normalize
    email = email.toLowerCase();
    templateName = templateName.toLowerCase();
    templateType = templateType.toLowerCase();
    orientation = orientation?.toLowerCase();
    mediaHeight = mediaHeight?.toLowerCase();

    // ✅ ENUM VALIDATIONS
    const validContentTypes = [
      "text",
      //"media",
      "rich card stand alone",
      "rich card carousel"
    ];

    const validOrientations = ["vertical", "horizontal"];
    const validMediaHeights = ["short", "medium"];

    if (!validContentTypes.includes(templateType)) {
      return sendResponse(400, { message: "Invalid templateType" });
    }

    if (orientation && !validOrientations.includes(orientation)) {
      return sendResponse(400, { message: "Invalid orientation" });
    }

    if (mediaHeight && !validMediaHeights.includes(mediaHeight)) {
      return sendResponse(400, { message: "Invalid mediaHeight" });
    }

    // ✅ VALIDATE SUGGESTIONS
    const validTypes = [
      "reply",
      "url action",
      "dialer action",
      "view location (lat/long)",
      "create calendar event"
    ];

    const validatedSuggestions = [];

    for (let s of suggestions) {
      let { type, text, postback, url, phone, latitude, longitude, label,
        startDate, endDate, eventTitle, description, timeZone } = s;

      if (!type || !text) {
        return sendResponse(400, {
          message: "Each suggestion must have type and text"
        });
      }

      type = type.toLowerCase();
      text = text.toLowerCase();

      if (!validTypes.includes(type)) {
        return sendResponse(400, {
          message: `Invalid suggestion type: ${type}`
        });
      }

      const suggestion = { type, text, postback };

      if (type === "url action") {
        if (!url) return sendResponse(400, { message: "url required" });
        suggestion.url = url;
      }

      if (type === "dialer action") {
        if (!phone) return sendResponse(400, { message: "phone required" });
        suggestion.phone = phone;
      }

      if (type === "view location (lat/long)") {
        if (!latitude || !longitude) {
          return sendResponse(400, { message: "lat/long required" });
        }
        suggestion.latitude = latitude;
        suggestion.longitude = longitude;
        suggestion.label = label || "";
      }

      if (type === "create calendar event") {
        if (!startDate) {
          return sendResponse(400, { message: "startDate required" });
        }
        suggestion.startDate = startDate;
        suggestion.endDate = endDate;
        suggestion.eventTitle = eventTitle;
        suggestion.description = description;
        suggestion.timeZone = timeZone;
      }

      validatedSuggestions.push(suggestion);
    }

    // ✅ LIMIT suggestions
    if (validatedSuggestions.length > 5) {
      return sendResponse(400, {
        message: "Maximum 5 suggestions allowed"
      });
    }

    // ✅ TIME
  
const now = new Date();

const createdAt = now.toISOString();
const updatedAt = createdAt;

const tstamp = Date.now();

// ✅ Force India timezone
const date = now.toLocaleDateString("en-GB", {
  timeZone: "Asia/Kolkata"
});

const time = now.toLocaleTimeString("en-IN", {
  timeZone: "Asia/Kolkata",
  hour12: true
});

const year = new Date(
  now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
).getFullYear();

    // ✅ FINAL OBJECT
    const templateId = generateId();

    const item = {
      id: templateId,
      botId,
      email,
      botName:botName.toLowerCase(),
      templateName,
      templateType,
      orientation,
      width,
      mediaHeight,

      cardUrl,
      cardTitle:cardTitle.toLowerCase(),
      cardDescription:cardDescription.toLowerCase(),
      status: "inactive", // Default status
      suggestions: validatedSuggestions,
      botDetails,
      createdAt,
      updatedAt,
      tstamp,
      date,
      time,
      year
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item
      })
    );

    return sendResponse(201, {
      message: "Template created successfully",
      template: item
    });

  } catch (error) {
    console.error(error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};










































































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
// import crypto from "crypto";

// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);

// const TABLE_NAME = "rcs_templates";

// // ✅ Response helper
// const sendResponse = (statusCode, body) => ({
//   statusCode,
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify(body)
// });

// // ✅ ID generator
// const generateId = () =>
//   "temp_" + crypto.randomBytes(2).toString("hex");

// export const handler = async (event) => {
//   try {
//     const body = event;

//     let {
//       botName,
//       email,
//       username,
//       templateName,
//       templateType,
//       orientation,
//       width,
//       mediaHeight,
//       cardUrl,
//       cardTitle,
//       cardDescription
//     } = body;

//     // ✅ Required fields
//     if (!botName|| !email || !templateName || !templateType) {
//       return sendResponse(400, {
//         message: "botId, email, templateName, templateType are required"
//       });
//     }

//     // ✅ Normalize
//     email = email.toLowerCase();
//     templateName = templateName.toLowerCase();
//     templateType = templateType.toLowerCase();
//     orientation = orientation?.toLowerCase();
//     mediaHeight = mediaHeight?.toLowerCase();

//     // ✅ ENUM VALIDATIONS
//     const validContentTypes = [
//       "text message",
//       "rich card stand alone",
//       "rich card carousel"
//     ];

//     const validOrientations = ["vertical", "horizontal"];
//     const validMediaHeights = ["short", "medium"];

//     if (!validContentTypes.includes(templateType)) {
//       return sendResponse(400, { message: "Invalid templateType" });
//     }

//     if (orientation && !validOrientations.includes(orientation)) {
//       return sendResponse(400, { message: "Invalid orientation" });
//     }

//     if (mediaHeight && !validMediaHeights.includes(mediaHeight)) {
//       return sendResponse(400, { message: "Invalid mediaHeight" });
//     }

//     // ✅ Time handling
//     const now = new Date();

//     const createdAt = now.toISOString();
//     const updatedAt = createdAt;

//     const tstamp = Date.now(); 
//     const date = now.toLocaleDateString("en-GB"); // dd/mm/yyyy
//     const time = now.toLocaleTimeString("en-IN"); // hh:mm:ss
//     const year = now.getFullYear();

//     // ✅ Create item
//     const templateId = generateId();

//     const item = {
//       id: templateId,

//       botName,
//       email,
//       username,

//       templateName,
//       templateType,

//       orientation,
//       width,
//       mediaHeight,

//       cardUrl,
//       cardTitle,
//       cardDescription,
//       status: "pending", // Default status
//       suggestions: [],

//       // timestamps
//       createdAt,
//       updatedAt,
//       tstamp,
//       date,
//       time,
//       year
//     };

//     // ✅ Save
//     await docClient.send(
//       new PutCommand({
//         TableName: TABLE_NAME,
//         Item: item
//       })
//     );

//     return sendResponse(201, {
//       message: "Template created successfully",
//       templateId,
//       template: item
//     });

//   } catch (error) {
//     console.error("Create template error:", error);

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });
//   }
// };