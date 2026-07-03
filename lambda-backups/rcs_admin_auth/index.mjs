import jwt from "jsonwebtoken";

const secretKey = "6yugghfghffygfutfuyuygiugiuiutrdtrs5s5ss5saaw54r687y9";

export const handler = async (event) => {
  try {

    let authHeader =
      event.authorizationToken ||
      event.headers?.Authorization ||
      event.headers?.authorization;

    if (!authHeader) {
      throw new Error("No token provided");
    }

    // Remove Bearer
    if (authHeader.startsWith("Bearer ")) {
      authHeader = authHeader.slice(7);
    }

    // Verify Token
    const decoded = jwt.verify(authHeader, secretKey);

    // Allow only admin or superAdmin
    if (
      decoded.role !== "admin" &&
      decoded.role !== "super-admin"
    ) {
      return {
        principalId: "unauthorized",
        policyDocument: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "execute-api:Invoke",
              Effect: "Deny",
              Resource: event.methodArn
            }
          ]
        }
      };
    }

    // Generate ARN
    const arnParts = event.methodArn.split(":");
    const apiGatewayArnTmp = arnParts[5].split("/");

    const region = arnParts[3];
    const accountId = arnParts[4];
    const apiId = apiGatewayArnTmp[0];
    const stage = apiGatewayArnTmp[1];

    const resourceArn =
      `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*/*`;

    // Allow Access
    return {
      principalId: decoded.email,

      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Allow",
            Resource: resourceArn
          }
        ]
      },

      context: {
        email: decoded.email,
        role: decoded.role
      }
    };

  } catch (e) {

    console.error("Auth error:", e.message);

    return {
      principalId: "unauthorized",

      policyDocument: {
        Version: "2012-10-17",
        Statement: [
          {
            Action: "execute-api:Invoke",
            Effect: "Deny",
            Resource: event.methodArn
          }
        ]
      },

      context: {
        error: e.message
      }
    };
  }
};