import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  DeleteCommand,
  BatchWriteCommand
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

    let { email, groupName, contactNumber } = body;

    // -----------------------------
    // VALIDATION
    // -----------------------------
    if (!email || !groupName) {
      return response(400, "email and groupName are required");
    }

    groupName = groupName.trim().toLowerCase();

    // =====================================================
    // CASE 1: DELETE SINGLE CONTACT
    // =====================================================
    if (contactNumber) {
      const normalized = normalizeNumber(contactNumber);

      if (!normalized) {
        return response(400, "Invalid contact number");
      }

      const sk = `GROUP#${groupName}#CONTACT#${normalized}`;

      try {
        await docClient.send(new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { email, sk },
          ConditionExpression: "attribute_exists(sk)" 
        }));

        return response(200, {
          message: "Contact deleted successfully"
        });

      } catch (error) {
        if (error.name === "ConditionalCheckFailedException") {
          return response(404, "Contact not found");
        }
        throw error;
      }
    }

    // =====================================================
    //  CASE 2: DELETE FULL GROUP
    // =====================================================
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "email = :email AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":email": email,
        ":sk": `GROUP#${groupName}`
      }
    }));

    const items = result.Items || [];

    if (items.length === 0) {
      return response(404, "Group not found");
    }

    // batch delete (25 max per request)
    for (let i = 0; i < items.length; i += 25) {
      const batch = items.slice(i, i + 25).map(item => ({
        DeleteRequest: {
          Key: {
            email: item.email,
            sk: item.sk
          }
        }
      }));

      await docClient.send(new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: batch
        }
      }));
    }

    return response(200, {
      message: "Group deleted successfully",
      deletedCount: items.length
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