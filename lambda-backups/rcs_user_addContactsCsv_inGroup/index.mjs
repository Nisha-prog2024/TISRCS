import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

const s3 = new S3Client({ region: "ap-south-1" });
const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-south-1" })
);

const TABLE_NAME = "rcs_user_group_contacts";
const BUCKET = "rcs-main";

// -----------------------------
// STREAM → STRING
// -----------------------------
const streamToString = async (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
  });
};

// -----------------------------
// FIND CORRECT KEY
// -----------------------------
const findCorrectKey = async (fileUrl) => {
  const parsed = new URL(fileUrl);
  const rawKey = parsed.pathname.slice(1);

  const prefix = rawKey.split("/").slice(0, -1).join("/") + "/";

  const list = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix
    })
  );

  if (!list.Contents || list.Contents.length === 0) {
    throw new Error("No files found in this folder");
  }

  const match = list.Contents.find(obj => obj.Key === rawKey);

  if (!match) {
    throw new Error("File not found in S3");
  }

  return match.Key;
};

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
    const body = event;

    let { email, groupName, fileUrl } = body;

    if (!email || !groupName || !fileUrl) {
      return {
        statusCode: 400,
        body: JSON.stringify("email, groupName, fileUrl required")
      };
    }

    groupName = groupName.toLowerCase();

    // -----------------------------
    // DATE & TIME (IST)
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
    const createdAt = istDate.toISOString();
    const tstamp = Date.now();

    // -----------------------------
    // FETCH FILE
    // -----------------------------
    const key = await findCorrectKey(fileUrl);

    const file = await s3.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key
      })
    );

    const csvText = await streamToString(file.Body);

    const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify("CSV must contain data")
      };
    }

    const contacts = [];
    const invalidNumbers = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");

      const number = cols[0]?.trim();
      const name = cols[1]?.trim();

      const normalized = normalizeNumber(number);

      if (normalized) {
        contacts.push({
          contactNumber: normalized,
          contactName: name
        });
      } else {
        if (number) invalidNumbers.push(number);
      }
    }

    // -----------------------------
    // STOP IF INVALID
    // -----------------------------
    if (invalidNumbers.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid numbers found",
          invalidNumbers
        })
      };
    }

    // remove duplicates
    const uniqueContacts = [
      ...new Map(contacts.map(c => [c.contactNumber, c])).values()
    ];

    // -----------------------------
    // SAVE CONTACTS
    // -----------------------------
    for (let i = 0; i < uniqueContacts.length; i += 25) {
      const batch = uniqueContacts.slice(i, i + 25).map(c => ({
        PutRequest: {
          Item: {
            email,
            sk: `GROUP#${groupName}#CONTACT#${c.contactNumber}`,
            groupName,
            contactNumber: c.contactNumber,
            contactName: c.contactName?.toLowerCase() || "",
            type: "CONTACT",
            date,
            time,
            year,
            createdAt,
            tstamp
          }
        }
      }));

      await ddb.send(
        new BatchWriteCommand({
          RequestItems: {
            [TABLE_NAME]: batch
          }
        })
      );
    }

    // -----------------------------
    // SAVE FILE META
    // -----------------------------
    await ddb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          email,
          sk: `GROUP#${groupName}#FILE`,
          groupName,
          fileUrl,
          type: "FILE",
          createdAt
        }
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Contacts uploaded successfully",
        totalInserted: uniqueContacts.length
      })
    };

  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify(err.message)
    };
  }
};
















































































// import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   BatchWriteCommand,
//   PutCommand
// } from "@aws-sdk/lib-dynamodb";

// const s3 = new S3Client({ region: "ap-south-1" });
// const ddb = DynamoDBDocumentClient.from(
//   new DynamoDBClient({ region: "ap-south-1" })
// );

// const TABLE_NAME = "rcs_user_group_contacts";
// const BUCKET = "rcs-main";

// // -----------------------------
// // STREAM → STRING
// // -----------------------------
// const streamToString = async (stream) => {
//   return new Promise((resolve, reject) => {
//     const chunks = [];
//     stream.on("data", (chunk) => chunks.push(chunk));
//     stream.on("error", reject);
//     stream.on("end", () => {
//       resolve(Buffer.concat(chunks).toString("utf-8"));
//     });
//   });
// };

// // -----------------------------
// //  FIND CORRECT S3 KEY (FIXED)
// // -----------------------------
// const findCorrectKey = async (fileUrl) => {
//   const parsed = new URL(fileUrl);
//   const rawKey = parsed.pathname.slice(1);

//   // dynamic prefix (important fix)
//   const prefix = rawKey.split("/").slice(0, -1).join("/") + "/";

//   console.log("Searching in prefix:", prefix);

//   const list = await s3.send(
//     new ListObjectsV2Command({
//       Bucket: BUCKET,
//       Prefix: prefix
//     })
//   );

//   if (!list.Contents || list.Contents.length === 0) {
//     throw new Error("No files found in this folder");
//   }

//   // exact match
//   const match = list.Contents.find(obj => obj.Key === rawKey);

//   if (!match) {
//     console.log("Available keys:");
//     list.Contents.forEach(o => console.log(o.Key));

//     throw new Error("File not found in S3 (name mismatch)");
//   }

//   console.log("✅ Found key:", match.Key);

//   return match.Key;
// };

// // -----------------------------
// // NORMALIZE NUMBER (IMPORTANT)
// // -----------------------------
// const normalizeNumber = (num) => {
//   if (!num) return null;

//   let cleaned = num.toString().replace(/\D/g, "");

//   // 91XXXXXXXXXX
//   if (cleaned.length === 12 && cleaned.startsWith("91")) {
//     return cleaned;
//   }

//   // 10 digit
//   if (/^[6-9]\d{9}$/.test(cleaned)) {
//     return "91" + cleaned;
//   }

//   return null;
// };

// // -----------------------------
// // MAIN HANDLER
// // -----------------------------
// export const handler = async (event) => {
//   try {
//     const body = event;

//     let { email, groupName, fileUrl } = body;

//     if (!email || !groupName || !fileUrl) {
//       return {
//         statusCode: 400,
//         body: JSON.stringify("email, groupName, fileUrl required")
//       };
//     }

//     groupName = groupName.toLowerCase();

//     // -----------------------------
//     // FIND FILE
//     // -----------------------------
//     const key = await findCorrectKey(fileUrl);

//     // -----------------------------
//     // FETCH CSV
//     // -----------------------------
//     const file = await s3.send(
//       new GetObjectCommand({
//         Bucket: BUCKET,
//         Key: key
//       })
//     );

//     const csvText = await streamToString(file.Body);

//     // -----------------------------
//     // PARSE CSV
//     // -----------------------------
//     const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);

//     if (lines.length < 2) {
//       return {
//         statusCode: 400,
//         body: JSON.stringify("CSV must contain header + data")
//       };
//     }

//     const contacts = [];
//     const invalidNumbers = [];

//     for (let i = 1; i < lines.length; i++) {
//       const cols = lines[i].split(",");

//       const number = cols[0]?.trim();
//       const name = cols[1]?.trim();

//       const normalized = normalizeNumber(number);

//       if (normalized) {
//         contacts.push({
//           contactNumber: normalized,
//           contactName: name
//         });
//       } else {
//         if (number) invalidNumbers.push(number);
//       }
//     }

//     // -----------------------------
//     // ❌ STOP IF INVALID
//     // -----------------------------
//     if (invalidNumbers.length > 0) {
//       return {
//         statusCode: 400,
//         body: JSON.stringify({
//           message: "Invalid numbers found. Group not created.",
//           invalidNumbers
//         })
//       };
//     }

//     // remove duplicates
//     const uniqueContacts = [
//       ...new Map(contacts.map(c => [c.contactNumber, c])).values()
//     ];

//     // -----------------------------
//     // SAVE CONTACTS
//     // -----------------------------
//     for (let i = 0; i < uniqueContacts.length; i += 25) {
//       const batch = uniqueContacts.slice(i, i + 25).map(c => ({
//         PutRequest: {
//           Item: {
//             email,
//             sk: `GROUP#${groupName}#CONTACT#${c.contactNumber}`,
//             groupName,
//             contactNumber: c.contactNumber,
//             contactName: c.contactName,
//             type: "CONTACT",
//             tstamp: Date.now()
//           }
//         }
//       }));

//       await ddb.send(
//         new BatchWriteCommand({
//           RequestItems: {
//             [TABLE_NAME]: batch
//           }
//         })
//       );
//     }

//     // -----------------------------
//     // SAVE FILE META
//     // -----------------------------
//     await ddb.send(
//       new PutCommand({
//         TableName: TABLE_NAME,
//         Item: {
//           email,
//           sk: `GROUP#${groupName}#FILE`,
//           groupName,
//           fileUrl,
//           type: "FILE",
//           createdAt: new Date().toISOString()
//         }
//       })
//     );

//     return {
//       statusCode: 200,
//       body: JSON.stringify({
//         message: "Contacts uploaded successfully",
//         totalInserted: uniqueContacts.length
//       })
//     };

//   } catch (err) {
//     console.error("ERROR:", err.message);

//     return {
//       statusCode: 500,
//       body: JSON.stringify(err.message)
//     };
//   }
// };


































































































// import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   BatchWriteCommand,
//   PutCommand
// } from "@aws-sdk/lib-dynamodb";

// const s3 = new S3Client({ region: "ap-south-1" });
// const ddb = DynamoDBDocumentClient.from(
//   new DynamoDBClient({ region: "ap-south-1" })
// );

// const TABLE_NAME = "rcs_user_group_contacts";
// const BUCKET = "rcs-main";

// // -----------------------------
// // STREAM → STRING
// // -----------------------------
// const streamToString = async (stream) => {
//   return new Promise((resolve, reject) => {
//     const chunks = [];
//     stream.on("data", (chunk) => chunks.push(chunk));
//     stream.on("error", reject);
//     stream.on("end", () => {
//       resolve(Buffer.concat(chunks).toString("utf-8"));
//     });
//   });
// };

// // -----------------------------
// // 🔥 FIND REAL S3 KEY (FINAL FIX)
// // -----------------------------
// const findCorrectKey = async (fileUrl) => {
//   const parsed = new URL(fileUrl);
//   const rawKey = parsed.pathname.slice(1);

//   const fileName = rawKey.split("/").pop(); // last part

//   console.log("Searching for file:", fileName);

//   const list = await s3.send(
//     new ListObjectsV2Command({
//       Bucket: BUCKET,
//       Prefix: "campaign/"
//     })
//   );

//   if (!list.Contents || list.Contents.length === 0) {
//     throw new Error("No files found in S3");
//   }

//   // try exact match first
//   let match = list.Contents.find(obj => obj.Key === rawKey);

//   // fallback: match by filename ignoring + / space
//   if (!match) {
//     match = list.Contents.find(obj =>
//       obj.Key.replace(/\+/g, " ").includes(fileName.replace(/\+/g, " "))
//     );
//   }

//   if (!match) {
//     console.log("Available keys:");
//     list.Contents.forEach(o => console.log(o.Key));

//     throw new Error("File not found in S3 (name mismatch)");
//   }

//   console.log("✅ Found key:", match.Key);

//   return match.Key;
// };

// // -----------------------------
// // NUMBER VALIDATION
// // -----------------------------
// const normalizeNumber = (num) => {
//   if (!num) return null;

//   let cleaned = num.toString().replace(/\D/g, "");

//   if (cleaned.length === 12 && cleaned.startsWith("91")) {
//     cleaned = cleaned.slice(2);
//   }

//   if (!/^[6-9]\d{9}$/.test(cleaned)) return null;

//   return "91" + cleaned;
// };

// // -----------------------------
// // MAIN HANDLER
// // -----------------------------
// export const handler = async (event) => {
//   try {
//     const body = event;

//     let { email, groupName, fileUrl } = body;

//     if (!email || !groupName || !fileUrl) {
//       return response(400, "email, groupName, fileUrl required");
//     }

//     groupName = groupName.toLowerCase();

//     // -----------------------------
//     // FIND CORRECT KEY
//     // -----------------------------
//     const key = await findCorrectKey(fileUrl);

//     // -----------------------------
//     // FETCH FILE
//     // -----------------------------
//     const file = await s3.send(
//       new GetObjectCommand({
//         Bucket: BUCKET,
//         Key: key
//       })
//     );

//     const csvText = await streamToString(file.Body);

//     // -----------------------------
//     // PARSE CSV
//     // -----------------------------
//     const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);

//     if (lines.length < 2) {
//       return response(400, "CSV must contain header + data");
//     }

//     const contacts = [];
//     const invalidNumbers = [];

//     for (let i = 1; i < lines.length; i++) {
//       const cols = lines[i].split(",");

//       const number = cols[0]?.trim();
//       const name = cols[1]?.trim();

//       const normalized = normalizeNumber(number);

//       if (normalized) {
//         contacts.push({
//           contactNumber: normalized,
//           contactName: name
//         });
//       } else {
//         if (number) invalidNumbers.push(number);
//       }
//     }

//     if (invalidNumbers.length > 0) {
//       return response(400, {
//         message: "Invalid numbers found. Group not created.",
//         invalidNumbers
//       });
//     }

//     const uniqueContacts = [
//       ...new Map(contacts.map(c => [c.contactNumber, c])).values()
//     ];

//     for (let i = 0; i < uniqueContacts.length; i += 25) {
//       const batch = uniqueContacts.slice(i, i + 25).map(c => ({
//         PutRequest: {
//           Item: {
//             email,
//             sk: `GROUP#${groupName}#CONTACT#${c.contactNumber}`,
//             groupName,
//             contactNumber: c.contactNumber,
//             contactName: c.contactName,
//             type: "CONTACT",
//             tstamp: Date.now()
//           }
//         }
//       }));

//       await ddb.send(
//         new BatchWriteCommand({
//           RequestItems: {
//             [TABLE_NAME]: batch
//           }
//         })
//       );
//     }

//     await ddb.send(
//       new PutCommand({
//         TableName: TABLE_NAME,
//         Item: {
//           email,
//           sk: `GROUP#${groupName}#FILE`,
//           groupName,
//           fileUrl,
//           type: "FILE",
//           createdAt: new Date().toISOString()
//         }
//       })
//     );

//     return response(200, {
//       message: "Contacts uploaded successfully",
//       totalInserted: uniqueContacts.length
//     });

//   } catch (err) {
//     console.error("FINAL ERROR:", err.message);
//     return response(500, err.message);
//   }
// };

// const response = (statusCode, body) => ({
//   statusCode,
//   body: JSON.stringify(body)
// });
























// import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   BatchWriteCommand,
//   PutCommand
// } from "@aws-sdk/lib-dynamodb";

// const s3 = new S3Client({ region: "ap-south-1" });
// const ddb = DynamoDBDocumentClient.from(
//   new DynamoDBClient({ region: "ap-south-1" })
// );

// const TABLE_NAME = "rcs_user_group_contacts";

// // -----------------------------
// // STREAM → STRING
// // -----------------------------
// const streamToString = async (stream) => {
//   return new Promise((resolve, reject) => {
//     const chunks = [];
//     stream.on("data", (chunk) => chunks.push(chunk));
//     stream.on("error", reject);
//     stream.on("end", () => {
//       resolve(Buffer.concat(chunks).toString("utf-8"));
//     });
//   });
// };

// // -----------------------------
// // NORMALIZE + VALIDATE NUMBER
// // -----------------------------
// const normalizeNumber = (num) => {
//   if (!num) return null;

//   // remove spaces, symbols
//   let cleaned = num.toString().replace(/\D/g, "");

//   // case: 91XXXXXXXXXX
//   if (cleaned.length === 12 && cleaned.startsWith("91")) {
//     cleaned = cleaned.slice(2);
//   }

//   // must be 10 digit starting 6-9
//   if (!/^[6-9]\d{9}$/.test(cleaned)) return null;

//   // store in consistent format
//   return "91" + cleaned;
// };

// export const handler = async (event) => {
//   try {
//     const body = event;

//     let { email, groupName, fileUrl } = body;

//     // -----------------------------
//     // 1. VALIDATION
//     // -----------------------------
//     if (!email || !groupName || !fileUrl) {
//       return response(400, "email, groupName, fileUrl required");
//     }

//     groupName = groupName.toLowerCase();

//     // -----------------------------
//     // 2. EXTRACT S3 KEY
//     // -----------------------------
//     const parsedUrl = new URL(fileUrl);
//     const bucket = parsedUrl.hostname.split(".")[0];
//     const key = parsedUrl.pathname.substring(1);

//     console.log("Bucket:", bucket);
//     console.log("Key:", key);

//     // -----------------------------
//     // 3. FETCH CSV
//     // -----------------------------
//     const file = await s3.send(
//       new GetObjectCommand({
//         Bucket: bucket,
//         Key: key
//       })
//     );

//     const csvText = await streamToString(file.Body);

//     // -----------------------------
//     // 4. PARSE CSV
//     // -----------------------------
//     const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);

//     if (lines.length < 2) {
//       return response(400, "CSV must contain header + data");
//     }

//     const contacts = [];
//     const invalidNumbers = [];

//     for (let i = 1; i < lines.length; i++) {
//       const row = lines[i];
//       const cols = row.split(",");

//       const number = cols[0]?.trim();
//       const name = cols[1]?.trim();

//       const normalized = normalizeNumber(number);

//       if (normalized) {
//         contacts.push({
//           contactNumber: normalized,
//           contactName: name
//         });
//       } else {
//         if (number) invalidNumbers.push(number);
//       }
//     }

//     // -----------------------------
//     // ❌ STOP IF ANY INVALID
//     // -----------------------------
//     if (invalidNumbers.length > 0) {
//       return response(400, {
//         message: "Invalid numbers found. Group not created.",
//         invalidNumbers
//       });
//     }

//     if (contacts.length === 0) {
//       return response(400, "No valid contacts found");
//     }

//     // -----------------------------
//     // REMOVE DUPLICATES
//     // -----------------------------
//     const uniqueContacts = [
//       ...new Map(contacts.map(c => [c.contactNumber, c])).values()
//     ];

//     // -----------------------------
//     // 5. SAVE CONTACTS (BATCH)
//     // -----------------------------
//     for (let i = 0; i < uniqueContacts.length; i += 25) {
//       const batch = uniqueContacts.slice(i, i + 25).map(c => ({
//         PutRequest: {
//           Item: {
//             email,
//             sk: `GROUP#${groupName}#CONTACT#${c.contactNumber}`,
//             groupName,
//             contactNumber: c.contactNumber,
//             contactName: c.contactName,
//             type: "CONTACT",
//             tstamp: Date.now()
//           }
//         }
//       }));

//       await ddb.send(
//         new BatchWriteCommand({
//           RequestItems: {
//             [TABLE_NAME]: batch
//           }
//         })
//       );
//     }

//     // -----------------------------
//     // 6. SAVE GROUP FILE META
//     // -----------------------------
//     await ddb.send(
//       new PutCommand({
//         TableName: TABLE_NAME,
//         Item: {
//           email,
//           sk: `GROUP#${groupName}#FILE`,
//           groupName,
//           fileUrl,
//           type: "FILE",
//           createdAt: new Date().toISOString()
//         }
//       })
//     );

//     // -----------------------------
//     // RESPONSE
//     // -----------------------------
//     return response(200, {
//       message: "Contacts uploaded successfully",
//       totalInserted: uniqueContacts.length
//     });

//   } catch (err) {
//     console.error(err);
//     return response(500, err.message);
//   }
// };

// // -----------------------------
// const response = (statusCode, body) => ({
//   statusCode,
//   body: JSON.stringify(body)
// });