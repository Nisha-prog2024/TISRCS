import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  GetCommand
} from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = "rcs_templates";

// Response helper
const sendResponse = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const handler = async (event) => {
  try {
    const body = event;

    let { id, status } = body;

    //  Validate input
    if (!id || !status) {
      return sendResponse(400, {
        message: "templateId and status are required"
      });
    }

    status = status.toLowerCase();

    //Allow only these
    const validStatus = ["active", "inactive"];

    if (!validStatus.includes(status)) {
      return sendResponse(400, {
        message: "Status must be 'active' or 'inactive'"
      });
    }

    // Check if template exists
    const { Item } = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { id: id }
      })
    );

    if (!Item) {
      return sendResponse(404, {
        message: "Template not found"
      });
    }

    
    const now = new Date();

    const updatedAt = now.toISOString();
    const tstamp = Date.now();

    const date = now.toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata"
    });

    const time = now.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: true
    });

    const year = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    ).getFullYear();

    
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { id: id },

        UpdateExpression:
          "SET #status = :status, #updatedAt = :updatedAt, #tstamp = :tstamp, #date = :date, #time = :time, #year = :year",

        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
          "#tstamp": "tstamp",
          "#date": "date",
          "#time": "time",
          "#year": "year"
        },

        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": updatedAt,
          ":tstamp": tstamp,
          ":date": date,
          ":time": time,
          ":year": year
        },

        ReturnValues: "ALL_NEW"
      })
    );

    return sendResponse(200, {
      message: "Template status updated successfully",
      updatedTemplate: result.Attributes
    });

  } catch (error) {
    console.error("Update status error:", error);

    return sendResponse(500, {
      message: "Internal server error",
      error: error.message
    });
  }
};