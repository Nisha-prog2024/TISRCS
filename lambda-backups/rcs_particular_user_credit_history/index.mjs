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

const client =
  new DynamoDBClient({
    region: "ap-south-1"
  });

const ddbDocClient =
  DynamoDBDocumentClient.from(
    client
  );

// ======================
// TABLE
// ======================

const TRANSACTION_TABLE =
  "rcs_credit";

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
// HANDLER
// ======================

export const handler = async (
  event
) => {

  try {

    // ======================
    // PARSE REQUEST
    // ======================

    const body =
      typeof event.body ===
      "string"
        ? JSON.parse(
            event.body
          )
        : event;

    const {

      email,

      startDate,

      endDate,

      

      type,

      status,

      transactionType,

      page = 1,

      limit = 10

    } = body;

    // ======================
    // VALIDATION
    // ======================

    if (!email) {

      return sendResponse(400, {

        message:
          "email is required"

      });

    }

    // ======================
    // FETCH TRANSACTIONS
    // ======================

    const response =
      await ddbDocClient.send(

        new ScanCommand({

          TableName:
            TRANSACTION_TABLE

        })

      );

    let transactions =
      response.Items || [];

    // ======================
    // FILTER USER HISTORY
    // ======================

    transactions =
  transactions.filter(
    (item) => {

      return (

        normalize(
          item.creditedTo
        ) ===
        normalize(email)

        &&

        normalize(
          item.type
        ) ===
        "credit"

      );

    }
  );

    

    // ======================
    // TYPE FILTER
    // credit / debit
    // ======================

    if (type) {

      transactions =
        transactions.filter(
          (item) =>
            normalize(
              item.type
            ) ===
            normalize(type)
        );

    }

    // ======================
    // STATUS FILTER
    // ======================

    if (status) {

      transactions =
        transactions.filter(
          (item) =>
            normalize(
              item.status
            ) ===
            normalize(status)
        );

    }

    // ======================
    // TRANSACTION TYPE FILTER
    // ======================

    if (
      transactionType
    ) {

      transactions =
        transactions.filter(
          (item) =>
            normalize(
              item.transactionType
            ) ===
            normalize(
              transactionType
            )
        );

    }

    // ======================
    // DATE RANGE FILTER
    // ======================

    if (
      startDate &&
      endDate
    ) {

      const start =
        new Date(
          `${startDate}T00:00:00`
        );

      const end =
        new Date(
          `${endDate}T23:59:59`
        );

      transactions =
        transactions.filter(
          (item) => {

            if (
              !item.createdAt
            ) {

              return false;

            }

            const createdAt =
              new Date(
                item.createdAt
              );

            return (
              createdAt >=
                start &&
              createdAt <=
                end
            );

          }
        );

    }

    // ======================
    // SORT LATEST FIRST
    // ======================

    transactions.sort(
      (a, b) => {

        return (
          new Date(
            b.createdAt || 0
          ) -
          new Date(
            a.createdAt || 0
          )
        );

      }
    );

    // ======================
    // PAGINATION
    // ======================

    const totalRecords =
      transactions.length;

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

    const paginatedTransactions =
      transactions.slice(
        startIndex,
        endIndex
      );

    // ======================
    // FINAL RESPONSE
    // ======================

    const history =
      paginatedTransactions.map(
        (item) => ({

          transactionId:
            item.id || "",

          email:
            item.email || "",

          creditedBy:
            item.creditedBy || "",

          creditedTo:
            item.creditedTo || "",

          transactionType:
            item.transactionType || "",

          

          type:
            item.type || "",

         
            amount:
            Number(
              item.currentBalance || 0
            ),
            walletAmount:
            Number(
              item.currentBalance || 0
            ),

          previousBalance:
            Number(
              item.previousBalance || 0
            ),

          currentBalance:
            Number(
              item.currentBalance || 0
            ),

          remark:
            item.remark || "",

          status:
            item.status || "",

          createdAt:
            item.createdAt || "",

          currentDate:
            item.currentDate || "",

          currentTime:
            item.currentTime || "",

          currentMonth:
            item.currentMonth || "",

          currentYear:
            item.currentYear || ""

        }))
;

    // ======================
    // SUCCESS RESPONSE
    // ======================

    return sendResponse(200, {

      message:
        "Credit history fetched successfully",

      totalRecords,

      currentPage,

      totalPages:
        Math.ceil(
          totalRecords /
          pageLimit
        ),

      limit:
        pageLimit,

      history

    });

  } catch (error) {

    console.error(
      "Credit History Error:",
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