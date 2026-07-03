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
// DATE PARSER
// ======================

const parseDate = (
  dateString
) => {

  if (!dateString) {
    return null;
  }

  const parts =
    dateString.split("-");

  // YYYY-MM-DD
  if (
    parts[0]?.length === 4
  ) {
    return new Date(
      dateString
    );
  }

  // DD-MM-YYYY
  if (
    parts[2]?.length === 4
  ) {

    const [
      day,
      month,
      year
    ] = parts;

    return new Date(
      `${year}-${month}-${day}`
    );
  }

  return null;
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
      
       
            event;

    const {

      email,

      startDate,
      endDate,

      bot,

      campaignForm,

      campaignType,

      template,

      country,

      campaignName,

      campaignId

    } = body;

    // ======================
    // EMAIL REQUIRED
    // ======================

    if (!email) {

      return sendResponse(400, {

        message:
          "email is required"

      });

    }

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

    let transactions =
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
    // FIND CURRENT USER
    // id = email
    // ======================

    const currentUser =
      users.find(
        (user) =>
          normalize(user.id) ===
          normalize(email)
      );

    // ======================
    // USER NOT FOUND
    // ======================

    if (!currentUser) {

      return sendResponse(404, {

        message:
          "User not found"

      });

    }

    // ======================
    // USER FILTER
    // ======================

    reports =
      reports.filter(
        (report) =>
          normalize(report.email) ===
          normalize(email)
      );

    transactions =
      transactions.filter(
        (transaction) =>
          normalize(transaction.email) ===
          normalize(email)
      );

    // ======================
    // DATE FILTER
    // ======================

    if (
      startDate &&
      endDate
    ) {

      reports =
        reports.filter(
          (report) => {

            if (
              !report.reportDate
            ) {

              return false;

            }

            const reportDate =
  parseDate(
    report.reportDate
  );

const start =
  parseDate(
    startDate
  );

const end =
  parseDate(
    endDate
  );

if (
  !reportDate ||
  !start ||
  !end
) {

  return false;

}

return (
  reportDate >= start &&
  reportDate <= end
);

          }
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
          (report) =>
            normalize(report.bot) ===
            normalize(bot)
        );

    }

    // ======================
    // CAMPAIGN FORM FILTER
    // ======================

    if (
      campaignForm &&
      normalize(campaignForm) !==
        "all"
    ) {

      reports =
        reports.filter(
          (report) =>
            normalize(
              report.campaignForm
            ) ===
            normalize(
              campaignForm
            )
        );

    }

    // ======================
    // CAMPAIGN TYPE FILTER
    // ======================

    if (
      campaignType &&
      normalize(campaignType) !==
        "all"
    ) {

      reports =
        reports.filter(
          (report) =>
            normalize(
              report.campaignType
            ) ===
            normalize(
              campaignType
            )
        );

    }

    // ======================
    // TEMPLATE FILTER
    // ======================

    if (
      template &&
      normalize(template) !==
        "all template"
    ) {

      reports =
        reports.filter(
          (report) =>
            normalize(
              report.template
            ).includes(
              normalize(
                template
              )
            )
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
          (report) =>
            normalize(
              report.country
            ) ===
            normalize(
              country
            )
        );

    }

    // ======================
    // CAMPAIGN NAME FILTER
    // ======================

    if (
      campaignName &&
      normalize(campaignName) !==
        ""
    ) {

      reports =
        reports.filter(
          (report) =>
            normalize(
              report.campaignName
            ).includes(
              normalize(
                campaignName
              )
            )
        );

    }

    // ======================
    // CAMPAIGN ID FILTER
    // ======================

    if (
      campaignId &&
      normalize(campaignId) !==
        ""
    ) {

      reports =
        reports.filter(
          (report) =>
            normalize(
              report.campaignId
            ) ===
            normalize(
              campaignId
            )
        );

    }

    // ======================
    // SUMMARY VARIABLES
    // ======================

    let totalRequests = 0;

    let totalSubmitted = 0;

    let totalDelivered = 0;

    let totalFailed = 0;

    let totalRead = 0;

    let totalRevoked = 0;

    let totalBilling = 0;

    // ======================
    // REPORT SUMMARY
    // ======================

    for (const report of reports) {

      totalRequests +=
        Number(
          report.sent || 0
        );

      totalSubmitted +=
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

      totalRead +=
        Number(
          report.read || 0
        );

      totalRevoked +=
        Number(
          report.revoked || 0
        );

    }

    // ======================
    // BILLING SUMMARY
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
    // BOT CHART
    // ======================

    const botMap = {};

    for (const report of reports) {

      const botName =
        report.bot || "Unknown";

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

    let richCount = 0;

    let textCount = 0;

    for (const report of reports) {

      if (
        normalize(
          report.campaignForm
        ) === "rich"
      ) {

        richCount++;

      }

      if (
        normalize(
          report.campaignForm
        ) === "text"
      ) {

        textCount++;

      }

    }

    const campaignFormChart = [

      {
        name: "rich",
        count: richCount
      },

      {
        name: "text",
        count: textCount
      }

    ];

    // ======================
    // FINAL RESPONSE
    // ======================

    return sendResponse(200, {

      message:
        "User dashboard fetched successfully",

        summary: {

          totalRequests,
        
          messagesSubmitted:
            totalSubmitted,
        
          messagesDelivered:
            totalDelivered,
        
          messagesFailed:
            totalFailed,
        
          messagesRead:
            totalRead,
        
          revokedExpired:
            totalRevoked,
        
          totalBilling,
        
          walletBalance:
            Number(
              currentUser
                ?.walletBalance || 0
            )
        
        },

        

      charts: {

        botChart,

        dateChart,

        campaignFormChart

      }

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