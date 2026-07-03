import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_admin_and_users";
const JWT_SECRET = "gfghfgfghfghfghty6r5486766678678@@@@^^6^66^";

const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  try {
    
    let { email, password } = event;

    if (!email || !password) {
      return sendResponse(400, {
        message: "Email and password are required"
      });
    }

    email = email.toLowerCase();

    // ✅ Fetch user
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

    if (Item.status !== "active") {
      return sendResponse(403, {
        message: "Account is inactive"
      });
    }

    // ✅ Verify password
    const isValid = await bcrypt.compare(password, Item.password);
    if (!isValid) {
      return sendResponse(401, {
        message: "Invalid email or password"
      });
    }

    // ✅ Extract IP (optional)
    const rawIp =
      event.requestContext?.identity?.sourceIp ||
      event.headers?.["x-forwarded-for"];

    const ip = rawIp ? rawIp.split(",")[0] : null;

    const loginTime = new Date().toISOString();

    // ✅ Conditional update
    let updateExpression = "SET lastLoginTime = :time";
    let expressionValues = {
      ":time": loginTime
    };

    if (ip) {
      updateExpression += ", lastLoginIp = :ip";
      expressionValues[":ip"] = ip;
    }

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: email },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionValues
      })
    );

    // ✅ Generate token
    const token = jwt.sign(
      {
        email: Item.id,
        role: Item.role
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return sendResponse(200, {
      message: "Login successful",
      token,
      user: {
        email: Item.id,
        username: Item.username,
        role: Item.role,
        lastLoginTime: loginTime,
        ...(ip && { lastLoginIp: ip }) // only if exists
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};