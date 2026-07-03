
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
  // TABLE
  // ======================
  
  const CAMPAIGN_REPORTS_TABLE =
    "rcs_campaign_reports";
  
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
  // PARSE DATE
  // DD-MM-YYYY
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
      parts[0].length === 4
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
        typeof event.body ===
        "string"
          ? JSON.parse(event.body)
          : event;
  
      const {
  
        startDate,
        endDate,
  
        clientEmail,
  
        status,
  
        bot,
  
        search
  
      } = body;
  
      // ======================
      // FETCH ALL REPORTS
      // ======================
  
      const response =
        await ddbDocClient.send(
          new ScanCommand({
            TableName:
              CAMPAIGN_REPORTS_TABLE
          })
        );
  
      let reports =
        response.Items || [];
  
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
      // CLIENT FILTER
      // ======================
  
      if (
        clientEmail &&
        clientEmail !==
          "All Clients"
      ) {
  
        reports =
          reports.filter(
            (report) =>
              report.email ===
              clientEmail
          );
  
      }
  
      // ======================
      // STATUS FILTER
      // ======================
  
      if (
        status &&
        status !==
          "All Statuses"
      ) {
  
        reports =
          reports.filter(
            (report) =>
              report.status
                ?.toLowerCase() ===
              status.toLowerCase()
          );
  
      }
  
      // ======================
      // BOT FILTER
      // ======================
  
      if (
        bot &&
        bot !== "All Bots"
      ) {
  
        reports =
          reports.filter(
            (report) =>
              report.bot
                ?.toLowerCase() ===
              bot.toLowerCase()
          );
  
      }
  
      // ======================
      // SEARCH FILTER
      // CAMPAIGN NAME OR ID
      // ======================
  
      if (search) {
  
        const searchValue =
          search.toLowerCase();
  
        reports =
          reports.filter(
            (report) => {
  
              return (
  
                report.campaignName
                  ?.toLowerCase()
                  .includes(
                    searchValue
                  ) ||
  
                report.campaignId
                  ?.toLowerCase()
                  .includes(
                    searchValue
                  )
  
              );
  
            }
          );
  
      }
  
      // ======================
      // SORT LATEST FIRST
      // ======================
  
      reports.sort(
        (a, b) =>
          new Date(
            b.importedAt
          ) -
          new Date(
            a.importedAt
          )
      );
  
      // ======================
      // RESPONSE
      // ======================
  
      return sendResponse(200, {
  
        message:
          "Campaign reports fetched successfully",
  
        totalReports:
          reports.length,
  
        reports
  
      });
  
    } catch (error) {
  
      console.error(
        "Filter Reports Error:",
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






























































































// import {
//   DynamoDBClient
// } from "@aws-sdk/client-dynamodb";

// import {
//   DynamoDBDocumentClient,
//   ScanCommand
// } from "@aws-sdk/lib-dynamodb";

// // ======================
// // AWS CONFIG
// // ======================

// const REGION = "ap-south-1";

// const dynamoClient =
//   new DynamoDBClient({
//     region: REGION
//   });

// const ddbDocClient =
//   DynamoDBDocumentClient.from(
//     dynamoClient
//   );

// // ======================
// // TABLE
// // ======================

// const CAMPAIGN_REPORTS_TABLE =
//   "rcs_campaign_reports";

// // ======================
// // COMMON RESPONSE
// // ======================

// const sendResponse = (
//   statusCode,
//   body
// ) => {

//   return {
//     statusCode,

//     headers: {
//       "Content-Type":
//         "application/json"
//     },

//     body: JSON.stringify(body)
//   };

// };

// // ======================
// // PARSE DATE
// // DD-MM-YYYY
// // ======================

// const parseDate = (
//   dateString
// ) => {

//   const [
//     day,
//     month,
//     year
//   ] =
//     dateString.split("-");

//   return new Date(
//     `${year}-${month}-${day}`
//   );

// };

// // ======================
// // HANDLER
// // ======================

// export const handler = async (
//   event
// ) => {

//   try {

//     // ======================
//     // PARSE BODY
//     // ======================

//     const body =
//       typeof event.body ===
//       "string"
//         ? JSON.parse(event.body)
//         : event;

//     const {

//       startDate,
//       endDate,

//       clientEmail,

//       status,

//       bot,

//       search

//     } = body;

//     // ======================
//     // FETCH ALL REPORTS
//     // ======================

//     const response =
//       await ddbDocClient.send(
//         new ScanCommand({
//           TableName:
//             CAMPAIGN_REPORTS_TABLE
//         })
//       );

//     let reports =
//       response.Items || [];

//     // ======================
//     // DATE FILTER
//     // ======================

//     if (
//       startDate &&
//       endDate
//     ) {

//       reports =
//         reports.filter(
//           (report) => {

//             if (
//               !report.reportDate
//             ) {
//               return false;
//             }

//             const reportDate =
//               parseDate(
//                 report.reportDate
//               );

//             const start =
//               parseDate(
//                 startDate
//               );

//             const end =
//               parseDate(
//                 endDate
//               );

//             return (
//               reportDate >= start &&
//               reportDate <= end
//             );

//           }
//         );

//     }

//     // ======================
//     // CLIENT FILTER
//     // ======================

//     if (
//       clientEmail &&
//       clientEmail !==
//         "All Clients"
//     ) {

//       reports =
//         reports.filter(
//           (report) =>
//             report.email ===
//             clientEmail
//         );

//     }

//     // ======================
//     // STATUS FILTER
//     // ======================

//     if (
//       status &&
//       status !==
//         "All Statuses"
//     ) {

//       reports =
//         reports.filter(
//           (report) =>
//             report.status
//               ?.toLowerCase() ===
//             status.toLowerCase()
//         );

//     }

//     // ======================
//     // BOT FILTER
//     // ======================

//     if (
//       bot &&
//       bot !== "All Bots"
//     ) {

//       reports =
//         reports.filter(
//           (report) =>
//             report.bot
//               ?.toLowerCase() ===
//             bot.toLowerCase()
//         );

//     }

//     // ======================
//     // SEARCH FILTER
//     // CAMPAIGN NAME OR ID
//     // ======================

//     if (search) {

//       const searchValue =
//         search.toLowerCase();

//       reports =
//         reports.filter(
//           (report) => {

//             return (

//               report.campaignName
//                 ?.toLowerCase()
//                 .includes(
//                   searchValue
//                 ) ||

//               report.campaignId
//                 ?.toLowerCase()
//                 .includes(
//                   searchValue
//                 )

//             );

//           }
//         );

//     }

//     // ======================
//     // SORT LATEST FIRST
//     // ======================

//     reports.sort(
//       (a, b) =>
//         new Date(
//           b.importedAt
//         ) -
//         new Date(
//           a.importedAt
//         )
//     );

//     // ======================
//     // RESPONSE
//     // ======================

//     return sendResponse(200, {

//       message:
//         "Campaign reports fetched successfully",

//       totalReports:
//         reports.length,

//       reports

//     });

//   } catch (error) {

//     console.error(
//       "Filter Reports Error:",
//       error
//     );

//     return sendResponse(500, {

//       message:
//         "Internal server error",

//       error:
//         error.message

//     });

//   }

// };