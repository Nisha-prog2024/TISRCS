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

const TABLE_NAME = "rcs_templates";

const GSI_NAME = "status-index";

const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

export const handler = async () => {
  try {

    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,

        IndexName: GSI_NAME,

        KeyConditionExpression:
          "#status = :status",

        ExpressionAttributeNames: {
          "#status": "status"
        },

        ExpressionAttributeValues: {
          ":status": "active"
        }
      })
    );

    const templates = result.Items || [];

    templates.sort(
      (a, b) =>
        new Date(b.createdAt) -
        new Date(a.createdAt)
    );

    return sendResponse(200, {
      message:
        "Active templates fetched successfully",

      totalTemplates:
        templates.length,

      templates
    });

  } catch (error) {

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};