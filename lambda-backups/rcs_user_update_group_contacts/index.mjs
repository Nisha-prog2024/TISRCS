import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  PutCommand,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_user_group_contacts";

// -----------------------------
// NORMALIZE + VALIDATE NUMBER
// Always returns 91XXXXXXXXXX or null
// -----------------------------
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

    let {
      email,
      groupName,
      oldContactNumber,
      newContactNumber,
      contactName
    } = body;

    // -----------------------------
    // 1. VALIDATION
    // -----------------------------
    if (!email || !groupName || !oldContactNumber) {
      return response(400, "email, groupName, oldContactNumber required");
    }

    groupName = groupName.trim().toLowerCase();
    if (contactName) contactName = contactName.trim();

    // normalize numbers
    const normalizedOld = normalizeNumber(oldContactNumber);
    if (!normalizedOld) {
      return response(400, "Invalid old contact number");
    }

    const normalizedNew = newContactNumber
      ? normalizeNumber(newContactNumber)
      : null;

    if (newContactNumber && !normalizedNew) {
      return response(400, "Invalid new contact number");
    }

    const oldSk = `GROUP#${groupName}#CONTACT#${normalizedOld}`;

    // -----------------------------
    // 2. CHECK EXISTING CONTACT
    // -----------------------------
    const existingRes = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { email, sk: oldSk }
    }));

    if (!existingRes.Item) {
      return response(404, "Contact not found");
    }

    const existing = existingRes.Item;

    const finalNumber = normalizedNew || normalizedOld;
    const finalName = contactName || existing.contactName;

    // -----------------------------
    // 3. ONLY NAME UPDATE
    // -----------------------------
    if (finalNumber === normalizedOld) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { email, sk: oldSk },
        UpdateExpression: `
          SET contactName = :name,
              updatedAt = :updatedAt,
              tstamp = :tstamp
        `,
        ExpressionAttributeValues: {
          ":name": finalName,
          ":updatedAt": new Date().toISOString(),
          ":tstamp": Date.now()
        }
      }));

      return response(200, {
        message: "Contact updated successfully"
      });
    }

    // -----------------------------
    // 4. NUMBER CHANGE
    // -----------------------------
    const newSk = `GROUP#${groupName}#CONTACT#${finalNumber}`;

    // check duplicate
    const duplicate = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { email, sk: newSk }
    }));

    if (duplicate.Item) {
      return response(400, "Contact with new number already exists");
    }

    // create new item
    const newItem = {
      ...existing,
      contactNumber: finalNumber,
      contactName: finalName.toLowerCase(),
      sk: newSk,
      updatedAt: new Date().toISOString(),
      tstamp: Date.now()
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newItem
    }));

    // delete old item
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { email, sk: oldSk }
    }));

    return response(200, {
      message: "Contact updated successfully (name + number)"
    });

  } catch (error) {
    console.error(error);
    return response(500, error.message);
  }
};

// -----------------------------
const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body)
});