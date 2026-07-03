import jwt from "jsonwebtoken";

const secretKey = "gfghfgfghfghfghty6r5486766678678@@@@^^6^66^";

export const handler = async (event) => {
  try {
    let authHeader =
      event.authorizationToken ||
      event.headers?.Authorization ||
      event.headers?.authorization;

    if (!authHeader) throw new Error("No token provided");

    if (authHeader.startsWith("Bearer ")) {
      authHeader = authHeader.slice(7);
    }

    const decoded = jwt.verify(authHeader, secretKey);

    if (decoded.role !== "user") {
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

    
    const arnParts = event.methodArn.split(":");
    const apiGatewayArnTmp = arnParts[5].split("/");

    const region = arnParts[3];
    const accountId = arnParts[4];
    const apiId = apiGatewayArnTmp[0];
    const stage = apiGatewayArnTmp[1];

    const resourceArn = `arn:aws:execute-api:${region}:${accountId}:${apiId}/${stage}/*/*`;

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












































































// import jwt from "jsonwebtoken";

// const secretKey = "gfghfgfghfghfghty6r5486766678678@@@@^^6^66^";

// export const handler = async (event) => {
//   try {
//     console.log("Incoming event:", event);

//     let authHeader =
//       event.authorizationToken ||
//       event.headers.Authorization ||
//       event.headers.authorization;

//     if (!authHeader) throw new Error("No token provided");

//     // Remove "Bearer " prefix if present
//     if (authHeader.startsWith("Bearer ")) authHeader = authHeader.slice(7);

//     // Verify token
//     const decoded = jwt.verify(authHeader, secretKey);
//     console.log("Decoded token:", decoded);

//     // Only allow role = "user"
//     if (decoded.role !== "user") {
//       console.log("User does not have sufficient role");
//       return {
//         principalId: "unauthorized",
//         policyDocument: {
//           Version: "2012-10-17",
//           Statement: [
//             {
//               Action: "execute-api:Invoke",
//               Effect: "Deny",
//               Resource: event.methodArn
//             }
//           ]
//         },
//         context: { error: "Insufficient role" }
//       };
//     }

//     // Return Allow policy
//     return {
//       principalId: decoded.name || decoded.email || "anonymous",
//       policyDocument: {
//         Version: "2012-10-17",
//         Statement: [
//           {
//             Action: "execute-api:Invoke",
//             Effect: "Allow",
//             Resource: event.methodArn
//           }
//         ]
//       }
//     };

//   } catch (e) {
//     console.error("Auth error:", e.message);
//     return {
//       principalId: decoded.email || "user",
//       policyDocument: {
//         Version: "2012-10-17",
//         Statement: [
//           {
//             Action: "execute-api:Invoke",
//             Effect: "Allow",
//             Resource: event.methodArn
//           }
//         ]
//       },
//       context: {
//         email: decoded.email,
//         role: decoded.role
//       }
//     };}
// };