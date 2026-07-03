import {
  S3Client,
  GetObjectCommand
} from "@aws-sdk/client-s3";

import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// AWS CONFIG
// ======================

const REGION = "ap-south-1";

const s3Client = new S3Client({
  region: REGION
});

const dynamoClient =
  new DynamoDBClient({
    region: REGION
  });

const ddbDocClient =
  DynamoDBDocumentClient.from(
    dynamoClient
  );

// ======================
// TABLES
// ======================

const USERS_TABLE =
  "rcs_admin_and_users";

const CAMPAIGNS_TABLE =
  "rcs_campaign";

const CAMPAIGN_REPORTS_TABLE =
  "rcs_campaign_reports";

const CAMPAIGN_TRANSACTIONS_TABLE =
  "rcs_campaign_transactions";

// ======================
// COMMON RESPONSE
// ======================

const sendResponse = (
  statusCode,
  body
) => {

  return {
    statusCode,

    headers: {
      "Content-Type":
        "application/json"
    },

    body: JSON.stringify(body)
  };

};

// ======================
// STREAM TO STRING
// ======================

const streamToString = async (
  stream
) => {

  const chunks = [];

  for await (
    const chunk of stream
  ) {

    chunks.push(chunk);

  }

  return Buffer.concat(
    chunks
  ).toString("utf-8");

};
// ======================
// CSV PARSER
// SUPPORTS QUOTED VALUES
// ======================

const parseCSV = (csvData) => {

  const lines = csvData
    .trim()
    .split(/\r?\n/);

  const parseLine = (line) => {

    const values = [];

    let current = "";

    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {

      const char = line[i];

      if (char === '"') {

        insideQuotes = !insideQuotes;

      }

      else if (
        char === "," &&
        !insideQuotes
      ) {

        values.push(
          current.trim()
        );

        current = "";

      }

      else {

        current += char;

      }
    }

    values.push(
      current.trim()
    );

    return values.map(
      value =>
        value.replace(
          /^"(.*)"$/,
          "$1"
        )
    );
  };

  const headers =
    parseLine(lines[0]);

  const rows = [];

  for (
    let i = 1;
    i < lines.length;
    i++
  ) {

    if (!lines[i].trim()) {

      continue;

    }

    const values =
      parseLine(lines[i]);

    const row = {};

    headers.forEach(
      (header, index) => {

        row[header] =
          values[index] || "";

      }
    );

    rows.push(row);

  }

  return rows;

};

// // ======================
// // SIMPLE CSV PARSER
// // ======================

// const parseCSV = (
//   csvData
// ) => {

//   const lines =
//     csvData
//       .trim()
//       .split("\n");

//   const headers =
//     lines[0]
//       .split(",")
//       .map(
//         (header) =>
//           header.trim()
//       );

//   const rows = [];

//   for (
//     let i = 1;
//     i < lines.length;
//     i++
//   ) {

//     const values =
//       lines[i]
//         .split(",")
//         .map(
//           (value) =>
//             value.trim()
//         );

//     const row = {};

//     headers.forEach(
//       (header, index) => {

//         row[header] =
//           values[index];

//       }
//     );

//     rows.push(row);

//   }

//   return rows;

// };

// ======================
// VALIDATE CSV HEADERS
// ======================

const validateCSVHeaders = (
  firstRow
) => {

  const requiredHeaders = [
    "campaignId",
    "sent",
    "delivered",
    "failed"
  ];

  for (
    const header of requiredHeaders
  ) {

    if (
      !Object.keys(
        firstRow
      ).includes(header)
    ) {

      return {
        valid: false,

        message:
          `${header} column missing`
      };

    }

  }

  return {
    valid: true
  };

};

// ======================
// HANDLER
// ======================

export const handler = async (
  event
) => {

  try {

    // ======================
    // PARSE BODY
    // ======================

    const body =
      typeof event.body ===
      "string"
        ? JSON.parse(event.body)
        : event;

    const { csvUrl } = body;

    // ======================
    // VALIDATION
    // ======================

    if (!csvUrl) {

      return sendResponse(400, {
        message:
          "csvUrl is required"
      });

    }

    // ======================
    // EXTRACT S3 DETAILS
    // ======================

    const url =
      new URL(csvUrl);

    const bucketName =
      url.hostname.split(".")[0];

    const key =
      decodeURIComponent(
        url.pathname.substring(1)
      );

    // ======================
    // READ CSV FROM S3
    // ======================

    const s3Object =
      await s3Client.send(
        new GetObjectCommand({
          Bucket: bucketName,
          Key: key
        })
      );

    const csvContent =
      await streamToString(
        s3Object.Body
      );

    // ======================
    // PARSE CSV
    // ======================

    const rows =
      parseCSV(csvContent);

    // ======================
    // EMPTY CSV CHECK
    // ======================

    if (
      !rows ||
      rows.length === 0
    ) {

      return sendResponse(400, {
        message:
          "CSV file is empty"
      });

    }

    // ======================
    // VALIDATE CSV HEADERS
    // ======================

    const validation =
      validateCSVHeaders(
        rows[0]
      );

    if (!validation.valid) {

      return sendResponse(400, {
        message:
          validation.message
      });

    }

    // ======================
    // RESULT ARRAYS
    // ======================

    const processedCampaigns =
      [];

    const failedCampaigns =
      [];

    // ======================
    // LOOP CSV ROWS
    // ======================

    for (const row of rows) {

      try {

        // ======================
        // CSV VALUES
        // ======================

        const campaignId =
          row.campaignId;

        const sent =
          Number(
            row.sent || 0
          );

        const delivered =
          Number(
            row.delivered || 0
          );

        const failed =
          Number(
            row.failed || 0
          );
          const status =
          row.status || "";
        
        const bot =
          row.bot || "";
        
        const reportDate =
          row.date || "";
        
        const reportTime =
          row.time || "";
        // ======================
        // CAMPAIGN ID VALIDATION
        // ======================

        if (!campaignId) {

          failedCampaigns.push({
            row,

            reason:
              "campaignId missing"
          });

          continue;

        }

        // ======================
        // FETCH CAMPAIGN
        // ======================

        const campaignResponse =
          await ddbDocClient.send(
            new GetCommand({
              TableName:
                CAMPAIGNS_TABLE,

              Key: {
                id: campaignId
              }
            })
          );

        const campaign =
          campaignResponse.Item;

        // ======================
        // CAMPAIGN NOT FOUND
        // ======================

        if (!campaign) {

          failedCampaigns.push({
            campaignId,

            reason:
              "Campaign not found"
          });

          continue;

        }

        // ======================
        // VALIDATE CAMPAIGN FORM
        // ======================

        if (
          !campaign.campaignForm ||
          !["text", "rich"].includes(
            campaign.campaignForm
          )
        ) {

          failedCampaigns.push({
            campaignId,

            reason:
              "campaignForm missing or invalid"
          });

          continue;

        }

        // ======================
        // DUPLICATE CHECK
        // ======================

        const existingReport =
          await ddbDocClient.send(
            new QueryCommand({
              TableName:
                CAMPAIGN_REPORTS_TABLE,

              IndexName:
                "campaignId-index",

              KeyConditionExpression:
                "campaignId = :campaignId",

              ExpressionAttributeValues:
                {
                  ":campaignId":
                    campaignId
                }
            })
          );

        if (
          existingReport.Items &&
          existingReport.Items.length > 0
        ) {

          failedCampaigns.push({
            campaignId,

            reason:
              "Report already imported"
          });

          continue;

        }

        // ======================
        // FETCH USER
        // ======================

        const userResponse =
          await ddbDocClient.send(
            new GetCommand({
              TableName:
                USERS_TABLE,

              Key: {
                id:
                  campaign.email
              }
            })
          );

        const user =
          userResponse.Item;

        // ======================
        // USER NOT FOUND
        // ======================

        if (!user) {

          failedCampaigns.push({
            campaignId,

            reason:
              "User not found"
          });

          continue;

        }

        // ======================
        // CHANNEL
        // FUTURE READY
        // ======================

        const channel =
          "rcs";

        // ======================
        // FETCH PRICE
        // ======================

        const price =
          Number(
            user[
              `${channel}Price`
            ] || 0
          );

        // ======================
        // FETCH DEDUCTION TYPE
        // ======================

        const deductionType =
          user[
            `${channel}DeductionType`
          ] ||
          "delivered";

        // ======================
        // MESSAGE COUNT
        // ======================

        const messageCount =
          deductionType ===
          "sent"
            ? sent
            : delivered;

        // ======================
        // TOTAL BILL
        // ======================

        const deductedAmount =
          messageCount *
          price;

        // ======================
        // DETERMINE WALLET
        // ======================

        const balanceField =
          campaign.campaignForm ===
          "text"
            ? "textCreditBalance"
            : "richCreditBalance";

        // ======================
        // PREVIOUS BALANCE
        // ======================

        const previousBalance =
          Number(
            user[
              balanceField
            ] || 0
          );

        // ======================
        // NEGATIVE ALLOWED
        // ======================

        const currentBalance =
          previousBalance -
          deductedAmount;

        // ======================
        // UPDATE USER BALANCE
        // ======================

        await ddbDocClient.send(
          new UpdateCommand({
            TableName:
              USERS_TABLE,

            Key: {
              id:
                campaign.email
            },

            UpdateExpression: `
              SET
              ${balanceField} = :balance,
              updatedAt = :updatedAt
            `,

            ExpressionAttributeValues:
              {
                ":balance":
                  currentBalance,

                ":updatedAt":
                  new Date().toISOString()
              }
          })
        );

        // ======================
        // SAVE REPORT
        // ======================

        await ddbDocClient.send(
          new PutCommand({
            TableName:
              CAMPAIGN_REPORTS_TABLE,

            Item: {
              id:
                `REPORT_${Date.now()}_${campaignId}`,

              campaignId,

              email:
                campaign.email,

              campaignName:
                campaign.campaignName,

              campaignForm:
                campaign.campaignForm,

              sent,

              delivered,
              status,

              bot,

             reportDate,

             reportTime,

              failed,

              deductedAmount,

              csvUrl,

              importedAt:
                new Date().toISOString()
            }
          })
        );

        // ======================
        // SAVE TRANSACTION
        // ======================
        // ======================
// CURRENT INDIA DATE TIME
// ======================

const indiaDateTime =
new Date().toLocaleString(
  "en-IN",
  {
    timeZone:
      "Asia/Kolkata"
  }
);

const [
currentDate,
currentTime
] = indiaDateTime.split(", ");
        await ddbDocClient.send(
          new PutCommand({
            TableName:
              CAMPAIGN_TRANSACTIONS_TABLE,

            Item: {
              id:
                `TXN_${Date.now()}_${campaignId}`,

              campaignId,

              email:
                campaign.email,

              campaignName:
                campaign.campaignName,

              campaignForm:
                campaign.campaignForm,

              channel,

              transactionType:
                "debit",

              deductionType,

              messageCount,

              pricePerMessage:
                price,

              deductedAmount,

              previousBalance,
              currentDate,

              currentTime,

              currentBalance,

              balanceField,

              createdAt:
                new Date().toISOString()
            }
          })
        );

        // ======================
        // SUCCESS RESPONSE DATA
        // ======================

        processedCampaigns.push({

          campaignId,

          campaignName:
            campaign.campaignName,

          campaignForm:
            campaign.campaignForm,

          sent,

          delivered,

          failed,

          deductionType,

          messageCount,

          pricePerMessage:
            price,

          deductedAmount,

          previousBalance,

          currentBalance,

          balanceStatus:
            currentBalance < 0
              ? "negative"
              : "positive"

        });

      } catch (error) {

        console.error(
          "Row Processing Error:",
          error
        );

        failedCampaigns.push({
          row,

          reason:
            error.message
        });

      }

    }

    // ======================
    // FINAL RESPONSE
    // ======================

    return sendResponse(200, {

      message:
        "CSV imported successfully",

      totalProcessed:
        processedCampaigns.length,

      totalFailed:
        failedCampaigns.length,

      processedCampaigns,

      failedCampaigns

    });

  } catch (error) {

    console.error(
      "Import CSV Error:",
      error
    );

    return sendResponse(500, {
      message:
        "Internal server error",

      error:
        error.message
    });

  }

};