import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  ScanCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// AWS CONFIG
// ======================

const REGION = "ap-south-1";

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

const REPORTS_TABLE =
  "rcs_campaign_reports";

const TRANSACTIONS_TABLE =
  "rcs_campaign_transactions";

const USERS_TABLE =
  "rcs_admin_and_users";

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
// NORMALIZE FUNCTION
// ======================

const normalize = (
  value
) => {

  return String(value || "")
    .trim()
    .toLowerCase();

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
      event.body
        ? JSON.parse(
            event.body
          )
        : event || {};

    const {

      startDate,

      endDate,

      bot,

      country

    } = body;

    // ======================
    // DEBUG LOGS
    // ======================

    console.log(
      "Request Body:",
      body
    );

    // ======================
    // FETCH REPORTS
    // ======================

    const reportsResponse =
      await ddbDocClient.send(
        new ScanCommand({
          TableName:
            REPORTS_TABLE
        })
      );

    let reports =
      reportsResponse.Items || [];

    console.log(
      "Total Reports Before Filter:",
      reports.length
    );

    // ======================
// DATE RANGE FILTER
// Supports:
// DD-MM-YYYY
// YYYY-MM-DD
// ======================

if (
  startDate &&
  endDate
) {

  const parseInputDate = (
    dateString,
    endOfDay = false
  ) => {

    // DD-MM-YYYY
    if (
      /^\d{2}-\d{2}-\d{4}$/
        .test(dateString)
    ) {

      const [
        day,
        month,
        year
      ] = dateString.split("-");

      return new Date(
        `${year}-${month}-${day}T${
          endOfDay
            ? "23:59:59"
            : "00:00:00"
        }`
      );

    }

    // YYYY-MM-DD
    if (
      /^\d{4}-\d{2}-\d{2}$/
        .test(dateString)
    ) {

      return new Date(
        `${dateString}T${
          endOfDay
            ? "23:59:59"
            : "00:00:00"
        }`
      );

    }

    return null;

  };

  const start =
    parseInputDate(
      startDate
    );

  const end =
    parseInputDate(
      endDate,
      true
    );

  console.log(
    "Parsed Start:",
    start
  );

  console.log(
    "Parsed End:",
    end
  );

  reports =
    reports.filter(
      (report) => {

        if (
          !report.reportDate
        ) {

          return false;

        }

        // DB date format:
        // DD-MM-YYYY

        const [
          day,
          month,
          year
        ] =
          report.reportDate.split(
            "-"
          );

        const reportDate =
          new Date(
            `${year}-${month}-${day}T00:00:00`
          );

        return (
          reportDate >=
            start &&
          reportDate <=
            end
        );

      }
    );

  console.log(
    "Reports After Date Filter:",
    reports.length
  );

}
    // ======================
    // BOT FILTER
    // ======================

    if (
      bot &&
      normalize(bot) !==
        "all bots"
    ) {

      reports =
        reports.filter(
          (report) => {

            return (
              normalize(
                report.bot || ""
              ) ===
              normalize(bot)
            );

          }
        );

      console.log(
        "Reports After Bot Filter:",
        reports.length
      );

    }

    // ======================
    // COUNTRY FILTER
    // ======================

    if (
      country &&
      normalize(country) !==
        "all countries"
    ) {

      reports =
        reports.filter(
          (report) => {

            return (
              normalize(
                report.country || ""
              ) ===
              normalize(country)
            );

          }
        );

      console.log(
        "Reports After Country Filter:",
        reports.length
      );

    }

    // ======================
    // FETCH TRANSACTIONS
    // ======================

    const transactionResponse =
      await ddbDocClient.send(
        new ScanCommand({
          TableName:
            TRANSACTIONS_TABLE
        })
      );

    const transactions =
      transactionResponse.Items || [];

    // ======================
    // FETCH USERS
    // ======================

    const usersResponse =
      await ddbDocClient.send(
        new ScanCommand({
          TableName:
            USERS_TABLE
        })
      );

    const users =
      usersResponse.Items || [];

    // ======================
    // SUMMARY VARIABLES
    // ======================

    let totalSent = 0;

    let totalDelivered = 0;

    let totalFailed = 0;

    let totalRichCampaigns = 0;

    let totalTextCampaigns = 0;

    let totalBilling = 0;

    let totalWalletBalance = 0;

    // ======================
    // REPORT LOOP
    // ======================

    for (const report of reports) {

      totalSent +=
        Number(
          report.sent || 0
        );

      totalDelivered +=
        Number(
          report.delivered || 0
        );

      totalFailed +=
        Number(
          report.failed || 0
        );

      if (
        normalize(
          report.campaignForm
        ) === "rich"
      ) {

        totalRichCampaigns++;

      }

      if (
        normalize(
          report.campaignForm
        ) === "text"
      ) {

        totalTextCampaigns++;

      }

    }

    // ======================
    // FILTERED BILLING
    // ======================

    // ======================
// FILTERED BILLING
// ======================

const matchedCampaignIds =
new Set(
  reports.map(
    report =>
      normalize(
        report.campaignId
      )
  )
);

totalBilling =
transactions
  .filter(
    transaction =>
      matchedCampaignIds.has(
        normalize(
          transaction.campaignId
        )
      )
  )
  .reduce(
    (
      sum,
      transaction
    ) =>
      sum +
      Number(
        transaction.amountDeducted || 0
      ),
    0
  );

    // ======================
    // WALLET LOOP
    // ======================

    for (const user of users) {

      totalWalletBalance +=
        Number(
          user.walletBalance || 0
        );
    
    }

    // ======================
    // BOT CHART
    // ======================

    const botMap = {};

    for (const report of reports) {

      const botName =
        report.bot ||
        "Unknown";

      if (!botMap[botName]) {

        botMap[botName] = {

          delivered: 0,

          sent: 0

        };

      }

      botMap[botName].delivered +=
        Number(
          report.delivered || 0
        );

      botMap[botName].sent +=
        Number(
          report.sent || 0
        );

    }

    const botChart =
      Object.entries(botMap).map(
        ([bot, values]) => ({

          bot,

          delivered:
            values.delivered,

          sent:
            values.sent

        })
      );

    // ======================
    // DATE CHART
    // ======================

    const dateMap = {};

    for (const report of reports) {

      const date =
        report.reportDate ||
        "Unknown";

      if (!dateMap[date]) {

        dateMap[date] = {

          delivered: 0,

          sent: 0

        };

      }

      dateMap[date].delivered +=
        Number(
          report.delivered || 0
        );

      dateMap[date].sent +=
        Number(
          report.sent || 0
        );

    }

    const dateChart =
      Object.entries(dateMap).map(
        ([date, values]) => ({

          date,

          delivered:
            values.delivered,

          sent:
            values.sent

        })
      );

    // ======================
    // FORM CHART
    // ======================

    const formChart = [

      {

        name: "rich",

        count:
          totalRichCampaigns

      },

      {

        name: "text",

        count:
          totalTextCampaigns

      }

    ];

    // ======================
    // STATUS CHART
    // ======================

    const statusMap = {};

    for (const report of reports) {

      const status =
        report.status ||
        "unknown";

      if (!statusMap[status]) {

        statusMap[status] = 0;

      }

      statusMap[status]++;

    }

    const statusChart =
      Object.entries(statusMap).map(
        ([status, count]) => ({

          status,

          count

        })
      );

    // ======================
    // FILTERED LATEST REPORTS
    // ======================

    const latestReports =
      reports
        .sort(
          (a, b) =>
            new Date(
              b.importedAt || 0
            ) -
            new Date(
              a.importedAt || 0
            )
        )
        .slice(0, 10);

    // ======================
    // FINAL RESPONSE
    // ======================

    return sendResponse(200, {

      message:
        "Dashboard data fetched successfully",

      summary: {

        totalCampaigns:
          reports.length,

        totalSent,

        totalDelivered,

        totalFailed,

        totalBilling,

        totalRichCampaigns,

        totalTextCampaigns,

        totalWalletBalance

      },

      charts: {

        botChart,

        dateChart,

        formChart,

        statusChart

      },

      latestReports

    });

  } catch (error) {

    console.error(
      "Dashboard Error:",
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

















