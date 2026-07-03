import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_templates";

const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  try {

    const body =
      typeof event.body === "string"
        ? JSON.parse(event.body)
        : event;

    let {
      templateId,
      status
    } = body;

    // ======================
    // Validation
    // ======================

    if (!templateId || !status) {
      return sendResponse(400, {
        message:
          "templateId and status are required"
      });
    }

    status = status.toLowerCase();

    const allowedStatus = [
      "active",
      "inactive"
    ];

    if (!allowedStatus.includes(status)) {
      return sendResponse(400, {
        message:
          "status must be active or inactive"
      });
    }

    // ======================
    // Check Exists
    // ======================

    const existingTemplate =
      await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            id: templateId
          }
        })
      );

    if (!existingTemplate.Item) {
      return sendResponse(404, {
        message:
          "Template not found"
      });
    }

    // ======================
    // Update Status
    // ======================

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,

        Key: {
          id: templateId
        },

        UpdateExpression:
          "set #status = :status, updatedAt = :updatedAt",

        ExpressionAttributeNames: {
          "#status": "status"
        },

        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt":
            new Date().toISOString()
        },

        ReturnValues: "ALL_NEW"
      })
    );

    // ======================
    // Fetch Updated
    // ======================

    const updatedTemplate =
      await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: {
            id: templateId
          }
        })
      );

    return sendResponse(200, {
      message:
        "Template status updated successfully",

      template:
        updatedTemplate.Item
    });

  } catch (error) {

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });

  }
};