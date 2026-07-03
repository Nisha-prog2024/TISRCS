import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// ✅ DB setup
const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_admin_and_users";
const JWT_SECRET = "6yugghfghffygfutfuyuygiugiuiutrdtrs5s5ss5saaw54r687y9";

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
    let { email, password } = event;

    // ✅ 1. Validation
    if (!email || !password) {
      return sendResponse(400, {
        message: "Email and password are required"
      });
    }

    email = email.toLowerCase();

    // ✅ 2. Get user from DB (PK = email)
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: email }
      })
    );

    if (!Item) {
      return sendResponse(401, {
        message: "Invalid email or password"
      });
    }

    // ✅ 3. Verify password
    const isPasswordValid = await bcrypt.compare(password, Item.password);

    if (!isPasswordValid) {
      return sendResponse(401, {
        message: "Invalid email or password"
      });
    }

    // ✅ 4. Generate JWT
    const token = jwt.sign(
      {
        email: Item.id,
        role: Item.role
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // ✅ 5. Success response
    return sendResponse(200, {
      message: "Login successful",
      token,
      email: Item.id,
      role: Item.role
    });

  } catch (error) {
    console.error("Login error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};