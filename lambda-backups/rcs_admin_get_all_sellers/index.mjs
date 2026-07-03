import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DynamoDB Config
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const ddbDocClient =
  DynamoDBDocumentClient.from(client);

// ======================
// Table Details
// ======================

const TABLE_NAME =
  "rcs_admin_and_users";

const GSI_NAME =
  "userType-index";

// ======================
// Common Response
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
// Lambda Handler
// ======================

export const handler = async () => {

  try {

    // ======================
    // Fetch Sellers
    // ======================

    const response =
      await ddbDocClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,

          IndexName: GSI_NAME,

          KeyConditionExpression:
            "userType = :userType",

          ExpressionAttributeValues:
            {
              ":userType":
                "seller"
            }
        })
      );

    // ======================
    // Filter Required Fields
    // ======================

    const filteredData =
      response.Items.map((item) => ({
        id: item.id,
        userType: item.userType
      }));

    // ======================
    // Success Response
    // ======================

    return sendResponse(200, {
      message:
        "Sellers fetched successfully",

      totalRecords:
        filteredData.length,

      data:
        filteredData
    });

  } catch (error) {

    console.error(
      "Fetch Sellers Error:",
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