import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_user_group_contacts";

export const handler = async (event) => {
  try {
    const body = event;

    let { email, groupName } = body;

    // -----------------------------
    // 1. VALIDATION
    // -----------------------------
    if (!email || !groupName) {
      return response(400, "email and groupName are required");
    }

    groupName = groupName.trim().toLowerCase();

    // -----------------------------
    // 2. QUERY CONTACTS
    // -----------------------------
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "email = :email AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":email": email,
        ":sk": `GROUP#${groupName}#CONTACT#`
      }
    }));

    // -----------------------------
    // 3. FORMAT RESPONSE
    // -----------------------------
    const contacts = (result.Items || []).map(item => ({
      contactName: item.contactName,
      contactNumber: item.contactNumber
    }));

    return response(200, {
      message: "Contacts fetched successfully",
      total: contacts.length,
      contacts
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