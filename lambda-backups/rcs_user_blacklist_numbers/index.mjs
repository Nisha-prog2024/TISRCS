import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

const TABLE_NAME =
  "rcs_user_blacklist_numbers";

const INDEX_NAME =
  "email-createdAt-index";

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
export const handler = async (
  event
) => {

  try {

    let {
      email,
      number
    } = event;

    if (!email) {

      return response(
        400,
        "email required"
      );

    }

    let queryParams = {

      TableName:
        TABLE_NAME,

      IndexName:
        INDEX_NAME,

      KeyConditionExpression:
        "email = :email",

      ExpressionAttributeValues:
        {
          ":email":
            email
        },

      // ✅ Latest first
      ScanIndexForward:
        false

    };

    // -----------------------------
    // CASE 2: EMAIL + NUMBER
    // -----------------------------
    if (number) {

      const normalized =
        normalizeNumber(
          number
        );

      if (!normalized) {

        return response(
          400,
          "Invalid number"
        );

      }

      queryParams.FilterExpression =
  "#num = :num";

queryParams.ExpressionAttributeNames =
  {
    "#num":
      "number"
  };

queryParams.ExpressionAttributeValues[
  ":num"
] = normalized;

    }

    // -----------------------------
    // EXECUTE QUERY
    // -----------------------------
    const result =
      await docClient.send(
        new QueryCommand(
          queryParams
        )
      );

    const items =
      result.Items || [];

    if (
      items.length === 0
    ) {

      return response(
        404,
        "number does not exist"
      );

    }

    const data =
      items.map(
        (item) => ({

          number:
            item.number,

          description:
            item.description,

          createdAt:
            item.createdAt

        })
      );

    return response(
      200,
      {

        message:
          "Blacklist data fetched",

        total:
          data.length,

        data

      }
    );

  } catch (error) {

    console.error(
      error
    );

    return response(
      500,
      error.message
    );

  }

};

// -----------------------------
const response = (
  statusCode,
  body
) => ({

  statusCode,

  body: JSON.stringify(
    body
  )

});









// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
// import {
//   DynamoDBDocumentClient,
//   QueryCommand
// } from "@aws-sdk/lib-dynamodb";

// const client = new DynamoDBClient({ region: "ap-south-1" });
// const docClient = DynamoDBDocumentClient.from(client);

// const TABLE_NAME = "rcs_user_blacklist_numbers";
// const INDEX_NAME = "email-index";

// // -----------------------------
// // NORMALIZE NUMBER
// // -----------------------------
// const normalizeNumber = (num) => {
//   if (!num) return null;

//   let cleaned = num.toString().replace(/\D/g, "");

//   if (cleaned.length === 12 && cleaned.startsWith("91")) {
//     return cleaned;
//   }

//   if (/^[6-9]\d{9}$/.test(cleaned)) {
//     return "91" + cleaned;
//   }

//   return null;
// };

// export const handler = async (event) => {
//   try {
//     let { email, number } = event;

//     if (!email) {
//       return response(400, "email required");
//     }

//     let queryParams = {
//       TableName: TABLE_NAME,
//       IndexName: INDEX_NAME,
//       KeyConditionExpression: "email = :email",
//       ExpressionAttributeValues: {
//         ":email": email
//       }
//     };

//     // -----------------------------
//     // CASE 2: EMAIL + NUMBER
//     // -----------------------------
//     if (number) {
//       const normalized = normalizeNumber(number);

//       if (!normalized) {
//         return response(400, "Invalid number");
//       }

//       // add sort key condition
//       queryParams.KeyConditionExpression += " AND #num = :num";
//       queryParams.ExpressionAttributeNames = {
//         "#num": "number"
//       };
//       queryParams.ExpressionAttributeValues[":num"] = normalized;
//     }

//     // -----------------------------
//     // EXECUTE QUERY
//     // -----------------------------
//     const result = await docClient.send(new QueryCommand(queryParams));

//     const items = result.Items || [];

//     if (items.length === 0) {
//       return response(404, "No data found");
//     }

//     const data = items.map(item => ({
//       number: item.number,
//       description: item.description,
//       createdAt: item.createdAt
//     }));

//     return response(200, {
//       message: "Blacklist data fetched",
//       total: data.length,
//       data
//     });

//   } catch (error) {
//     console.error(error);
//     return response(500, error.message);
//   }
// };

// // -----------------------------
// const response = (statusCode, body) => ({
//   statusCode,
//   body: JSON.stringify(body)
// });