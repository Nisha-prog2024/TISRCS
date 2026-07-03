import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  DeleteCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_user_blacklist_numbers";

// -----------------------------
// NORMALIZE NUMBER
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
    let { email, number } = event;

    // -----------------------------
    // VALIDATION
    // -----------------------------
    if (!email || !number) {
      return response(400, "email and number required");
    }

    const normalized = normalizeNumber(number);

    if (!normalized) {
      return response(400, "Invalid number");
    }

    const sk = `BLACKLIST#${normalized}`;

    // -----------------------------
    // DELETE
    // -----------------------------
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        email,
        sk
      },
      ConditionExpression: "attribute_exists(sk)"
    }));

    return response(200, {
      message: "Blacklist number deleted successfully"
    });

  } catch (error) {
    console.error(error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(404, "Blacklist number not found");
    }

    return response(500, error.message);
  }
};

// -----------------------------
const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body)
});