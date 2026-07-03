import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// ✅ DB setup
const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_admin_and_users";

// ✅ Response helper
const sendResponse = (statusCode, body) => {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
};

export const handler = async (event) => {
  try {
    // ✅ Get email from query params
    const email = event.email;

    if (!email) {
      return sendResponse(400, {
        message: "Email is required"
      });
    }

    const normalizedEmail = email.toLowerCase();

    // ✅ Fetch user
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: normalizedEmail }
      })
    );

    if (!Item) {
      return sendResponse(404, {
        message: "User not found"
      });
    }

    // ✅ Remove password
    const { password, ...userWithoutPassword } = Item;

    return sendResponse(200, {
      message: "User fetched successfully",
      user: userWithoutPassword
    });

  } catch (error) {
    console.error("Get user error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};