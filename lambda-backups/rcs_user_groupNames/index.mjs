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
    const email = event.email;

    // -----------------------------
    // 1. VALIDATION
    // -----------------------------
    if (!email) {
      return response(400, "email is required");
    }

    // -----------------------------
    // 2. GET ALL GROUPS
    // -----------------------------
    const groupResult = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "email = :email AND begins_with(sk, :groupPrefix)",
      FilterExpression: "#type = :typeVal",
      ExpressionAttributeNames: {
        "#type": "type"
      },
      ExpressionAttributeValues: {
        ":email": email,
        ":groupPrefix": "GROUP#",
        ":typeVal": "GROUP"
      }
    }));

    const groups = groupResult.Items || [];

    // -----------------------------
    // 3. GET CONTACT COUNT PER GROUP
    // -----------------------------
    const finalGroups = await Promise.all(
      groups.map(async (group) => {
        const groupName = group.groupName;

        const contactResult = await docClient.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression:
            "email = :email AND begins_with(sk, :contactPrefix)",
          ExpressionAttributeValues: {
            ":email": email,
            ":contactPrefix": `GROUP#${groupName}#CONTACT`
          },
          Select: "COUNT"
        }));

        return {
          groupName: group.groupName,
          description: group.description,
          totalContacts: contactResult.Count,
          createdAt: group.createdAt,
          date: group.date,
          time: group.time
        };
      })
    );

    // -----------------------------
    // 4. RESPONSE
    // -----------------------------
    return response(200, {
      message: "Groups fetched successfully",
      count: finalGroups.length,
      groups: finalGroups
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