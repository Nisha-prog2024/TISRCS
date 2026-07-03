import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  BatchWriteCommand
} from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({ region: "ap-south-1" });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-south-1" })
);

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
  // including numbers starting with 91
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return cleaned;
  }

  return null;
};

// -----------------------------
// STREAM → STRING
// -----------------------------
const streamToString = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () =>
      resolve(Buffer.concat(chunks).toString("utf-8"))
    );
  });
};

export const handler = async (event) => {
  try {
    const body = event;

    let { email, number, description, fileUrl } = body;

    if (!email) {
      return response(400, "email required");
    }

    // -----------------------------
    // DATE (IST)
    // -----------------------------
    const now = new Date();
    const istDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    );

    const createdAt = istDate.toISOString();
    const tstamp = Date.now();

    // =====================================================
    // CASE 1: SINGLE NUMBER
    // =====================================================
    if (number) {
      const normalized = normalizeNumber(number);

      if (!normalized) {
        return response(400, "Invalid mobile number");
      }

      const item = {
        email,
        sk: `BLACKLIST#${normalized}`,
        number: normalized,
        description: description || "",
        type: "BLACKLIST",
        createdAt,
        tstamp
      };

      await ddb.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(sk)"
      }));

      return response(200, {
        message: "Number added to blacklist",
        number: normalized
      });
    }

    // =====================================================
    // CASE 2: CSV UPLOAD
    // =====================================================
    if (fileUrl) {
      const url = new URL(fileUrl);
      const key = decodeURIComponent(url.pathname.substring(1));

      const file = await s3.send(
        new GetObjectCommand({
          Bucket: url.hostname.split(".")[0],
          Key: key
        })
      );

      const csvText = await streamToString(file.Body);

      const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);

      const valid = [];
      const invalid = [];

      for (let i = 1; i < lines.length; i++) {
        const num = lines[i].split(",")[0]?.trim();

        const normalized = normalizeNumber(num);

        if (normalized) {
          valid.push(normalized);
        } else {
          invalid.push(num);
        }
      }

      if (invalid.length > 0) {
        return response(400, {
          message: "Invalid numbers found. Blacklist not created.",
          invalidNumbers: invalid
        });
      }

      // remove duplicates
      const unique = [...new Set(valid)];

      // batch insert
      for (let i = 0; i < unique.length; i += 25) {
        const batch = unique.slice(i, i + 25).map(num => ({
          PutRequest: {
            Item: {
              email,
              sk: `BLACKLIST#${num}`,
              number: num,
              description: description || "",
              type: "BLACKLIST",
              createdAt,
              tstamp
            }
          }
        }));

        await ddb.send(new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch
          }
        }));
      }

      return response(200, {
        message: "Blacklist uploaded successfully",
        totalInserted: unique.length
      });
    }

    return response(400, "Provide number or fileUrl");

  } catch (error) {
    console.error(error);

    if (error.name === "ConditionalCheckFailedException") {
      return response(400, "Number already blacklisted");
    }

    return response(500, error.message);
  }
};

// -----------------------------
const response = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body)
});