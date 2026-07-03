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

const TABLE_NAME = "rcs_user_blacklist_numbers";

// -----------------------------
// NORMALIZE NUMBER → 91XXXXXXXXXX
// -----------------------------
const normalizeNumber = (num) => {
  if (!num) return null;

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
    const { email, oldNumber, newNumber, description } = event;

    // -----------------------------
    // 1. VALIDATION
    // -----------------------------
    if (!email || !oldNumber) {
      return response(400, "email and oldNumber required");
    }

    const normalizedOld = normalizeNumber(oldNumber);
    if (!normalizedOld) {
      return response(400, "Invalid old number");
    }

    const oldSk = `BLACKLIST#${normalizedOld}`;

    // -----------------------------
    // 2. FETCH EXISTING ITEM
    // -----------------------------
    const existingRes = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { email, sk: oldSk }
    }));

    if (!existingRes.Item) {
      return response(404, "Blacklist entry not found");
    }

    const existing = existingRes.Item;

    const updatedAt = new Date().toISOString();
    const tstamp = Date.now();

    // =====================================================
    // ✅ CASE 1: ONLY DESCRIPTION UPDATE
    // =====================================================
    if (!newNumber) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { email, sk: oldSk },
        UpdateExpression: `
          SET description = :desc,
              updatedAt = :updatedAt,
              tstamp = :tstamp
        `,
        ExpressionAttributeValues: {
          ":desc": description ?? existing.description,
          ":updatedAt": updatedAt,
          ":tstamp": tstamp
        }
      }));

      return response(200, {
        message: "Blacklist updated successfully"
      });
    }

    // =====================================================
    // ✅ CASE 2: NUMBER CHANGE (CREATE + DELETE)
    // =====================================================
    const normalizedNew = normalizeNumber(newNumber);
    if (!normalizedNew) {
      return response(400, "Invalid new number");
    }

    const newSk = `BLACKLIST#${normalizedNew}`;

    // ❌ prevent duplicate
    const dupRes = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { email, sk: newSk }
    }));

    if (dupRes.Item) {
      return response(400, "Number already exists in blacklist");
    }

    // -----------------------------
    // STEP 1: CREATE NEW ITEM
    // -----------------------------
    const newItem = {
      ...existing,
      number: normalizedNew,
      description: description ?? existing.description,
      sk: newSk,
      updatedAt,
      tstamp
    };

    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newItem,
      ConditionExpression: "attribute_not_exists(sk)"
    }));

    // -----------------------------
    // STEP 2: DELETE OLD ITEM (STRICT)
    // -----------------------------
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { email, sk: oldSk },
      ConditionExpression: "attribute_exists(sk)"
    }));

    return response(200, {
      message: "Blacklist updated successfully (number + description)"
    });

  } catch (error) {
    console.error(error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(400, "Operation failed (duplicate or missing item)");
    }

    return response(500, error.message);
  }
};

// -----------------------------
const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body)
});