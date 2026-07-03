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

const USERS_TABLE =
  "rcs_admin_and_users";

const CAMPAIGN_TABLE =
  "rcs_campaign";

const TRANSACTIONS_TABLE =
  "rcs_campaign_transactions";

// ======================
// RESPONSE FUNCTION
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

      campaignId,

      page = 1,

      limit = 20

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
    // FETCH CAMPAIGNS
    // ======================

    const campaignsResponse =
      await ddbDocClient.send(
        new ScanCommand({
          TableName:
            CAMPAIGN_TABLE
        })
      );

    const campaigns =
      campaignsResponse.Items || [];

    // ======================
    // FETCH TRANSACTIONS
    // ======================

    const transactionsResponse =
      await ddbDocClient.send(
        new ScanCommand({
          TableName:
            TRANSACTIONS_TABLE
        })
      );

    const transactions =
      transactionsResponse.Items || [];

    // ======================
    // USER FILTER
    // ======================

    reports =
      reports.filter(
        (report) =>
          normalize(report.email) ===
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
    // TEMPLATE FILTER
    // ======================

    if (
      template &&
      normalize(template) !==
        "all template"
    ) {

      reports =
        reports.filter(
          (report) => {

            const matchedCampaign =
              campaigns.find(
                (campaign) =>
                  normalize(
                    campaign.id
                  ) ===
                  normalize(
                    report.campaignId
                  )
              );

            return normalize(
              matchedCampaign
                ?.template
            ).includes(
              normalize(
                template
              )
            );

          }
        );

    }

    // ======================
    // SORT LATEST FIRST
    // ======================

    reports.sort(
      (a, b) => {

        return (
          new Date(
            b.importedAt ||
            b.createdAt ||
            0
          ) -
          new Date(
            a.importedAt ||
            a.createdAt ||
            0
          )
        );

      }
    );
    const totalBilling =
    reports.reduce(
      (sum, report) => {
  
        const matchedTransaction =
          transactions.find(
            (transaction) =>
  
              normalize(
                transaction.campaignId
              ) ===
              normalize(
                report.campaignId
              )
          );
  
        return (
          sum +
          Number(
            matchedTransaction
              ?.amountDeducted || 0
          )
        );
  
      },
      0
    );
    // ======================
    // PAGINATION
    // ======================

    const totalRecords =
      reports.length;

    const currentPage =
      Number(page);

    const pageLimit =
      Number(limit);

    const startIndex =
      (currentPage - 1) *
      pageLimit;

    const endIndex =
      startIndex +
      pageLimit;

    const paginatedReports =
      reports.slice(
        startIndex,
        endIndex
      );

    // ======================
    // TABLE DATA
    // ======================

    const tableData =
      paginatedReports.map(
        (report) => {

          // ======================
          // FETCH TEMPLATE
          // ======================

          const matchedCampaign =
            campaigns.find(
              (campaign) =>
                normalize(
                  campaign.id
                ) ===
                normalize(
                  report.campaignId
                )
            );

          const finalTemplate =
            matchedCampaign
              ?.template || "";

          // ======================
          // FETCH BILLING
          // ======================

          
          const matchedTransaction =
          transactions.find(
            (transaction) =>
        
              normalize(
                transaction.campaignId
              ) ===
              normalize(
                report.campaignId
              )
          );
        
        const finalBilling =
          Number(
            matchedTransaction
              ?.amountDeducted || 0
          );

          // ======================
          // RETURN TABLE DATA
          // ======================

          return {

            campaignId:
              report.campaignId || "",

            campaignName:
              report.campaignName || "",

            bot:
              report.bot || "",

            template:
              finalTemplate,

            country:
              report.country || "",

            campaignForm:
              report.campaignForm || "",

            campaignType:
              report.campaignType || "",

            status:
              report.status || "",

            sent:
              Number(
                report.sent || 0
              ),

            delivered:
              Number(
                report.delivered || 0
              ),

            failed:
              Number(
                report.failed || 0
              ),

            read:
              Number(
                report.read || 0
              ),

            revoked:
              Number(
                report.revoked || 0
              ),

              billing: {

                amountDeducted:
                  finalBilling,
              
                campaignForm:
                  matchedTransaction
                    ?.campaignForm || "",
              
                totalNumbers:
                  Number(
                    matchedTransaction
                      ?.totalNumbers || 0
                  ),
              
                openingBalance:
                  Number(
                    matchedTransaction
                      ?.openingBalance || 0
                  ),
              
                closingBalance:
                  Number(
                    matchedTransaction
                      ?.closingBalance || 0
                  ),
              
                deductionType:
              
                  matchedTransaction
                    ?.billingDetails
                    ?.smsDeductionType ||
              
                  matchedTransaction
                    ?.billingDetails
                    ?.rcsDeductionType ||
              
                  ""
              },

            reportDate:
              report.reportDate || "",

            reportTime:
              report.reportTime || "",

            importedAt:
              report.importedAt || ""

          };

        }
      );

    // ======================
    // FINAL RESPONSE
    // ======================

    return sendResponse(200, {

      message:
        "Dashboard table fetched successfully",

      totalRecords,

      currentPage,

      totalPages:
        Math.ceil(
          totalRecords /
          pageLimit
        ),

      limit:
        pageLimit,

        wallet: {

          walletBalance:
            Number(
              currentUser
                ?.walletBalance || 0
            )
        
        },
        totalBilling,
      reports:
        tableData

    });

  } catch (error) {

    console.error(
      "Dashboard Table Error:",
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