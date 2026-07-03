import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
    DynamoDBDocumentClient,
    ScanCommand
} from "@aws-sdk/lib-dynamodb";

// ======================
// DynamoDB Config
// ======================

const client = new DynamoDBClient({
    region: "ap-south-1"
});

const docClient =
    DynamoDBDocumentClient.from(client);

// ======================
// Table Details
// ======================

const CAMPAIGN_TABLE = "rcs_campaign";

// ======================
// Response Helper
// ======================

const response = (
    statusCode,
    body
) => ({
    statusCode,

    headers: {
        "Content-Type":
            "application/json"
    },

    body: JSON.stringify(body)
});

// ======================
// Lambda Handler
// ======================

export const handler = async () => {

    try {

        // ======================
        // Fetch All Campaigns
        // ======================

        const campaignData =
            await docClient.send(
                new ScanCommand({
                    TableName: CAMPAIGN_TABLE
                })
            );

        const campaigns =
            campaignData.Items || [];

        // ======================
        // Sort Latest First
        // ======================

        campaigns.sort(
            (a, b) => b.tstamp - a.tstamp
        );

        // ======================
        // Success Response
        // ======================

        return response(200, {
            message:
                "All campaigns fetched successfully",

            totalCampaigns:
                campaigns.length,

            data: campaigns
        });

    } catch (error) {

        console.error(
            "Fetch Campaigns Error:",
            error
        );

        return response(500, {
            message:
                "Internal server error",

            error:
                error.message
        });
    }
};