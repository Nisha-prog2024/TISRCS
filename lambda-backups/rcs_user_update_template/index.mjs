import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_templates";

//  Response helper
const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  try {
    const body = event;

    const {
      id,

      botId,
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

      suggestions
    } = body;

    // ✅ Validate templateId
    if (!id) {
      return sendResponse(400, {
        message: "templateId is required"
      });
    }

    // Check if template exists
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: id }
      })
    );

    if (!Item) {
      return sendResponse(404, {
        message: "Template not found"
      });
    }

    //  ENUM VALIDATIONS
    const validContentTypes = [
      "text message",
      "rich card stand alone",
      "rich card carousel"
    ];

    const validOrientations = ["vertical", "horizontal"];
    const validMediaHeights = ["short", "medium"];

    if (
      templateType &&
      !validContentTypes.includes(templateType.toLowerCase())
    ) {
      return sendResponse(400, { message: "Invalid templateType" });
    }

    if (
      orientation &&
      !validOrientations.includes(orientation.toLowerCase())
    ) {
      return sendResponse(400, { message: "Invalid orientation" });
    }

    if (
      mediaHeight &&
      !validMediaHeights.includes(mediaHeight.toLowerCase())
    ) {
      return sendResponse(400, { message: "Invalid mediaHeight" });
    }

    //  VALIDATE SUGGESTIONS
    const validTypes = [
      "reply",
      "url action",
      "dialer action",
      "view location (lat/long)",
      "create calendar event"
    ];

    let validatedSuggestions;

    if (suggestions) {
      validatedSuggestions = [];

      for (let s of suggestions) {
        let {
          type,
          text,
          postback,
          url,
          phone,
          latitude,
          longitude,
          label,
          startDate,
          endDate,
          eventTitle,
          description,
          timeZone
        } = s;

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

      if (validatedSuggestions.length > 5) {
        return sendResponse(400, {
          message: "Maximum 5 suggestions allowed"
        });
      }
    }

    // LOWERCASE CONTROL (ONLY THESE FIELDS)
    const LOWERCASE_FIELDS = [
      "templateName",
      "templateType",
      "orientation",
      "mediaHeight",
      "botName",
      "username"
    ];

    // DYNAMIC UPDATE
    let updateExpression = "SET ";
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    let index = 0;

    const addField = (key, value) => {
      if (value !== undefined) {
        // apply lowercase only for selected fields
        if (LOWERCASE_FIELDS.includes(key) && typeof value === "string") {
          value = value.toLowerCase();
        }

        updateExpression += `#k${index} = :v${index}, `;
        expressionAttributeNames[`#k${index}`] = key;
        expressionAttributeValues[`:v${index}`] = value;

        index++;
      }
    };

    //  Add all fields
    addField("botId", botId);
    addField("botName", botName);
    addField("username", username);

    addField("templateName", templateName);
    addField("templateType", templateType);
    addField("orientation", orientation);
    addField("width", width);
    addField("mediaHeight", mediaHeight);

    addField("cardUrl", cardUrl);
    addField("cardTitle", cardTitle.toLowerCase());
    addField("cardDescription", cardDescription);

    if (validatedSuggestions) {
      addField("suggestions", validatedSuggestions);
    }

    if (index === 0) {
      return sendResponse(400, {
        message: "No fields provided to update"
      });
    }

    //TIMEZONE (IST)
    const now = new Date();

    const updatedAt = now.toISOString();
    const tstamp = Date.now();

    const date = now.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata"
    });

    const time = now.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true
    });

    const year = now.getFullYear();

   // ✅ Add timestamps
updateExpression +=
"#updatedAt = :updatedAt, #tstamp = :tstamp, #date = :date, #time = :time, #year = :year";

expressionAttributeNames["#updatedAt"] = "updatedAt";
expressionAttributeNames["#tstamp"] = "tstamp";
expressionAttributeNames["#date"] = "date";
expressionAttributeNames["#time"] = "time";
expressionAttributeNames["#year"] = "year";

expressionAttributeValues[":updatedAt"] = updatedAt;
expressionAttributeValues[":tstamp"] = tstamp;
expressionAttributeValues[":date"] = date;
expressionAttributeValues[":time"] = time;
expressionAttributeValues[":year"] = year;

    // ✅ UPDATE DB
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: id },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ReturnValues: "ALL_NEW"
      })
    );

    return sendResponse(200, {
      message: "Template updated successfully",
      updatedTemplate: result.Attributes
    });

  } catch (error) {
    console.error("Update template error:", error);

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

// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);

// const TABLE_NAME = "rcs_templates";

// // ✅ Response helper
// const sendResponse = (statusCode, body) => ({
//   statusCode,
//   headers: { "Content-Type": "application/json" },
//   body: JSON.stringify(body)
// });

// export const handler = async (event) => {
//   try {
//     const body = event;

//     const {
//       id,

//       botId,
//       botName,
//       username,

//       templateName,
//       templateType,
//       orientation,
//       width,
//       mediaHeight,

//       cardUrl,
//       cardTitle,
//       cardDescription,

//       suggestions
//     } = body;

//     // ✅ Validate templateId
//     if (!id) {
//       return sendResponse(400, {
//         message: "templateId is required"
//       });
//     }

//     // ✅ Check template exists
//     const { Item } = await docClient.send(
//       new GetCommand({
//         TableName: TABLE_NAME,
//         Key: { id: id }
//       })
//     );

//     if (!Item) {
//       return sendResponse(404, {
//         message: "Template not found"
//       });
//     }

//     // ✅ ENUM VALIDATIONS
//     const validContentTypes = [
//       "text message",
//       "rich card stand alone",
//       "rich card carousel"
//     ];

//     const validOrientations = ["vertical", "horizontal"];
//     const validMediaHeights = ["short", "medium"];

//     // ✅ Normalize selected fields
//     const normalizedTemplateName = templateName?.toLowerCase();
//     const normalizedTemplateType = templateType?.toLowerCase();
//     const normalizedOrientation = orientation?.toLowerCase();
//     const normalizedMediaHeight = mediaHeight?.toLowerCase();

//     const normalizedBotName = botName?.toLowerCase();
//     const normalizedUsername = username?.toLowerCase();

//     if (
//       normalizedTemplateType &&
//       !validContentTypes.includes(normalizedTemplateType)
//     ) {
//       return sendResponse(400, { message: "Invalid templateType" });
//     }

//     if (
//       normalizedOrientation &&
//       !validOrientations.includes(normalizedOrientation)
//     ) {
//       return sendResponse(400, { message: "Invalid orientation" });
//     }

//     if (
//       normalizedMediaHeight &&
//       !validMediaHeights.includes(normalizedMediaHeight)
//     ) {
//       return sendResponse(400, { message: "Invalid mediaHeight" });
//     }

//     // ✅ Validate Suggestions (if provided)
//     const validTypes = [
//       "reply",
//       "url action",
//       "dialer action",
//       "view location (lat/long)",
//       "create calendar event"
//     ];

//     let validatedSuggestions;

//     if (suggestions) {
//       validatedSuggestions = [];

//       for (let s of suggestions) {
//         let {
//           type,
//           text,
//           postback,
//           url,
//           phone,
//           latitude,
//           longitude,
//           label,
//           startDate,
//           endDate,
//           eventTitle,
//           description,
//           timeZone
//         } = s;

//         if (!type || !text) {
//           return sendResponse(400, {
//             message: "Each suggestion must have type and text"
//           });
//         }

//         type = type.toLowerCase();
//         text = text.toLowerCase();

//         if (!validTypes.includes(type)) {
//           return sendResponse(400, {
//             message: `Invalid suggestion type: ${type}`
//           });
//         }

//         const suggestion = { type, text, postback };

//         if (type === "url action") {
//           if (!url) return sendResponse(400, { message: "url required" });
//           suggestion.url = url;
//         }

//         if (type === "dialer action") {
//           if (!phone) return sendResponse(400, { message: "phone required" });
//           suggestion.phone = phone;
//         }

//         if (type === "view location (lat/long)") {
//           if (!latitude || !longitude) {
//             return sendResponse(400, { message: "lat/long required" });
//           }
//           suggestion.latitude = latitude;
//           suggestion.longitude = longitude;
//           suggestion.label = label || "";
//         }

//         if (type === "create calendar event") {
//           if (!startDate) {
//             return sendResponse(400, { message: "startDate required" });
//           }
//           suggestion.startDate = startDate;
//           suggestion.endDate = endDate;
//           suggestion.eventTitle = eventTitle;
//           suggestion.description = description;
//           suggestion.timeZone = timeZone;
//         }

//         validatedSuggestions.push(suggestion);
//       }

//       if (validatedSuggestions.length > 5) {
//         return sendResponse(400, {
//           message: "Maximum 5 suggestions allowed"
//         });
//       }
//     }

//     // ✅ Dynamic Update Expression
//     let updateExpression = "SET ";
//     const expressionAttributeNames = {};
//     const expressionAttributeValues = {};
//     let index = 0;

//     const addField = (key, value) => {
//       if (value !== undefined) {
//         updateExpression += `#k${index} = :v${index}, `;
//         expressionAttributeNames[`#k${index}`] = key;
//         expressionAttributeValues[`:v${index}`] = value;
//         index++;
//       }
//     };

//     //  NEW FIELDS
//     addField("botId", botId);
//     addField("botName", normalizedBotName);
//     addField("username", normalizedUsername);

//     //  EXISTING FIELDS
//     addField("templateName", normalizedTemplateName);
//     addField("templateType", normalizedTemplateType);
//     addField("orientation", normalizedOrientation);
//     addField("width", width);
//     addField("mediaHeight", normalizedMediaHeight);
//     addField("cardUrl", cardUrl);
//     addField("cardTitle", cardTitle);
//     addField("cardDescription", cardDescription);

//     if (validatedSuggestions) {
//       addField("suggestions", validatedSuggestions);
//     }

//     if (index === 0) {
//       return sendResponse(400, {
//         message: "No fields provided to update"
//       });
//     }

//     // ✅ updatedAt
//     updateExpression += "updatedAt = :updatedAt";
//     expressionAttributeValues[":updatedAt"] = new Date().toISOString();

//     // ✅ Update DB
//     const result = await docClient.send(
//       new UpdateCommand({
//         TableName: TABLE_NAME,
//         Key: { id: id },
//         UpdateExpression: updateExpression,
//         ExpressionAttributeNames: expressionAttributeNames,
//         ExpressionAttributeValues: expressionAttributeValues,
//         ReturnValues: "ALL_NEW"
//       })
//     );

//     return sendResponse(200, {
//       message: "Template updated successfully",
//       updatedTemplate: result.Attributes
//     });

//   } catch (error) {
//     console.error("Update template error:", error);

//     return sendResponse(500, {
//       message: "Internal server error",
//       error: error.message
//     });
//   }
// };