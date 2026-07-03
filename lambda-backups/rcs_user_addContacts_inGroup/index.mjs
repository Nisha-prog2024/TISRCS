import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_user_group_contacts";

// -----------------------------
// NORMALIZE + VALIDATE NUMBER
// -----------------------------
const normalizeNumber = (num) => {
  if (!num) return null;

  // remove spaces, +, -, alphabets, etc.
  let cleaned = num.toString().replace(/\D/g, "");

  // If number is 12 digit and starts with 91
  // remove 91 and save only 10 digit number
  if (
    cleaned.length === 12 &&
    cleaned.startsWith("91")
  ) {

    cleaned = cleaned.slice(2);

  }

  // Allow all valid Indian mobile numbers
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
};

export const handler = async (event) => {
  try {
    const body = event;

    let { email, groupName, contactName, contactNumber } = body;

    // -----------------------------
    // 1. VALIDATION
    // -----------------------------
    if (!email || !groupName || !contactName || !contactNumber) {
      return response(400, "All fields are required");
    }

    groupName = groupName.trim().toLowerCase();
    contactName = contactName.trim();

    // -----------------------------
    // 2. NORMALIZE NUMBER
    // -----------------------------
    const normalizedNumber = normalizeNumber(contactNumber);

    if (!normalizedNumber) {
      return response(400, "Invalid mobile number");
    }

    // -----------------------------
    // 3. DATE
    // -----------------------------
    const now = new Date();
    const istDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const item = {
      email,
      sk: `GROUP#${groupName}#CONTACT#${normalizedNumber}`,
      groupName,
      contactName:contactName.toLowerCase(),
      contactNumber: normalizedNumber, // always 91 format
      type: "CONTACT",
      date: istDate.toISOString().split("T")[0],
      time: istDate.toLocaleTimeString("en-IN"),
      year: istDate.getFullYear(),
      tstamp: Date.now(),
      createdAt: istDate.toISOString()
    };

    // -----------------------------
    // 4. SAVE (NO DUPLICATE)
    // -----------------------------
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
      ConditionExpression: "attribute_not_exists(sk)"
    }));

    return response(200, {
      message: "Contact added successfully",
      savedNumber: normalizedNumber
    });

  } catch (error) {
    console.error(error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(400, "Contact already exists in group");
    }

    return response(500, error.message);
  }
};

// -----------------------------
const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body)
});








































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   PutCommand
// } from "@aws-sdk/lib-dynamodb";

// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);

// const TABLE_NAME = "rcs_user_group_contacts";

// export const handler = async (event) => {
//   try {
//     const body = event;

//     let { email, groupName, contactName, contactNumber } = body;

//     // -----------------------------
//     // 1. VALIDATION
//     // -----------------------------
//     if (!email || !groupName || !contactName || !contactNumber) {
//       return response(400, "All fields are required");
//     }

//     // normalize
//     groupName = groupName.trim().toLowerCase();
//     contactName = contactName.trim();
//     contactNumber = contactNumber.toString().trim();

//     // number validation (India)
//     if (!/^[6-9]\d{9}$/.test(contactNumber)) {
//       return response(400, "Invalid mobile number");
//     }

//     // -----------------------------
//     // 2. DATE
//     // -----------------------------
//     const now = new Date();
//     const istDate = new Date(
//       now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
//     );

//     const item = {
//       email,
//       sk: `GROUP#${groupName}#CONTACT#${contactNumber}`,
//       groupName,
//       contactName,
//       contactNumber,
//       type: "CONTACT",
//       date: istDate.toISOString().split("T")[0],
//       time: istDate.toLocaleTimeString("en-IN"),
//       year: istDate.getFullYear(),
//       tstamp: Date.now(),
//       createdAt: istDate.toISOString()
//     };

//     // -----------------------------
//     // 3. SAVE (NO DUPLICATE)
//     // -----------------------------
//     await docClient.send(new PutCommand({
//       TableName: TABLE_NAME,
//       Item: item,
//       ConditionExpression: "attribute_not_exists(sk)"
//     }));

//     return response(200, {
//       message: "Contact added successfully"
//     });

//   } catch (error) {
//     if (error.name === "ConditionalCheckFailedException") {
//       return response(400, "Contact already exists in group");
//     }
//     return response(500, error.message);
//   }
// };

// const response = (statusCode, body) => ({
//   statusCode,
//   body: JSON.stringify(body)
// });