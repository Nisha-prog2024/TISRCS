import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_user_group_contacts";

export const handler = async (event) => {
  try {
    const body = event;

    let { email, groupName, description } = body;

    // -----------------------------
    // 1. VALIDATION
    // -----------------------------
    if (!email || !groupName || !description) {
      return response(400, "email, groupName and description are required");
    }

    // -----------------------------
    // 2. NORMALIZE (LOWERCASE)
    // -----------------------------
    groupName = groupName.trim().toLowerCase();
    description = description.trim().toLowerCase();

    // -----------------------------
    // 3. DATE & TIME (IST)
    // -----------------------------
    const now = new Date();

    const istDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const date = istDate.toISOString().split("T")[0];

    const time = istDate.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true
    });

    const year = istDate.getFullYear();

    const tstamp = Date.now();
    const createdAt = istDate.toISOString();

    const sk = `GROUP#${groupName}`;

    // -----------------------------
    // 4. SAVE (UNIQUE CHECK)
    // -----------------------------
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        email,
        sk,
        groupName,
        description,
        type: "GROUP",
        date,
        time,
        year,
        tstamp,
        createdAt
      },
      ConditionExpression: "attribute_not_exists(sk)"
    }));

    // -----------------------------
    // 5. RESPONSE
    // -----------------------------
    return response(200, {
      message: "Group created successfully",
      groupName
    });

  } catch (error) {
    console.error(error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(400, "Group name already exists");
    }

    return response(500, error.message);
  }
};

// -----------------------------
const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body)
});