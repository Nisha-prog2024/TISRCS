import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand
} from "@aws-sdk/lib-dynamodb";

import nodemailer from "nodemailer";

import bcrypt from "bcryptjs";

// ======================
// DynamoDB Configuration
// ======================

const client = new DynamoDBClient({
  region: "ap-south-1"
});

const docClient =
  DynamoDBDocumentClient.from(client);

// ======================
// Table Name
// ======================

const TABLE_NAME =
  "rcs_admin_and_users";

// ======================
// Email Configuration
// ======================

const transporter =
  nodemailer.createTransport({

    service: "gmail",

    auth: {

      user:
        "omini.truebulksms@gmail.com",

      pass:
        "pswn utnf rwid swip"
    }
  });

// ======================
// Response Helper
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

    body:
      JSON.stringify(body)
  };
};

// ======================
// Email Validation
// ======================

const isValidEmail = (
  email
) => {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
};

// ======================
// Generate OTP
// ======================

const generateOTP = () => {

  return Math.floor(
    100000 +
    Math.random() * 900000
  ).toString();
};

// ======================
// Forgot Password API
// ======================

export const handler =
  async (event) => {

    try {

      // ======================
      // Parse Request
      // ======================

      let { email } = event;

      // ======================
      // Validation
      // ======================

      if (!email) {

        return sendResponse(
          400,
          {
            message:
              "email is required"
          }
        );
      }

      email =
        email.toLowerCase().trim();

      if (
        !isValidEmail(email)
      ) {

        return sendResponse(
          400,
          {
            message:
              "Invalid email format"
          }
        );
      }

      // ======================
      // Check User Exists
      // ======================

      const result =
        await docClient.send(

          new GetCommand({

            TableName:
              TABLE_NAME,

            Key: {
              id: email
            }
          })
        );

      const user =
        result.Item;

      // ======================
      // User Not Found
      // ======================

      if (!user) {

        return sendResponse(
          404,
          {
            message:
              "User not found"
          }
        );

      }

      // ======================
      // Generate OTP
      // ======================

      const otp =
        generateOTP();

      // ======================
      // Hash OTP
      // ======================

      const hashedOtp =
        await bcrypt.hash(
          otp,
          10
        );

      // ======================
      // OTP Expiry
      // 10 minutes
      // ======================

      const otpExpiry =
        Date.now() +
        10 * 60 * 1000;

      // ======================
      // Save OTP in DB
      // ======================

      await docClient.send(

        new UpdateCommand({

          TableName:
            TABLE_NAME,

          Key: {
            id: email
          },

          UpdateExpression:
            `
            SET
            forgotPasswordOtp = :otp,
            forgotPasswordOtpExpiry = :expiry,
            updatedAt = :updatedAt
            `,

          ExpressionAttributeValues: {

            ":otp":
              hashedOtp,

            ":expiry":
              otpExpiry,

            ":updatedAt":
              new Date().toISOString()
          }
        })
      );

      // ======================
      // Send Email
      // ======================

      await transporter.sendMail({

        from:
          "omini.truebulksms@gmail.com",

        to:
          email,

        subject:
          "Password Reset OTP",

        html: `

        <div
          style="
            font-family:
            Arial,
            sans-serif;
            max-width:
            600px;
            margin:auto;
            padding:20px;
            border:1px solid #ddd;
            border-radius:8px;
          "
        >

          <h2>
            Password Reset Request
          </h2>

          <p>
            Hello,
          </p>

          <p>
            We received a request
            to reset your account
            password.
          </p>

          <p>
            Please use the OTP
            below to continue:
          </p>

          <div
            style="
              font-size:32px;
              font-weight:bold;
              letter-spacing:6px;
              margin:20px 0;
              color:#2c3e50;
            "
          >
            ${otp}
          </div>

          <p>
            This OTP is valid for
            <b>10 minutes</b>.
          </p>

          <p>
            If you did not request
            a password reset,
            please ignore this email.
          </p>

          <br>

          <p>
            Regards,
            <br>
            Support Team
          </p>

        </div>
        `
      });

      // ======================
      // Success Response
      // ======================

      return sendResponse(
        200,
        {
          message:
            "OTP sent successfully"
        }
      );

    } catch (error) {

      console.error(
        "Forgot Password Error:",
        error
      );

      return sendResponse(
        500,
        {
          message:
            "Internal server error",

          error:
            error.message
        }
      );
    }
};






























































// import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// import {
//   DynamoDBDocumentClient,
//   GetCommand,
//   UpdateCommand
// } from "@aws-sdk/lib-dynamodb";

// import nodemailer from "nodemailer";

// import bcrypt from "bcryptjs";

// // ======================
// // DynamoDB Configuration
// // ======================

// const client = new DynamoDBClient({
//   region: "ap-south-1"
// });

// const docClient =
//   DynamoDBDocumentClient.from(client);

// // ======================
// // Table Name
// // ======================

// const TABLE_NAME =
//   "rcs_admin_and_users";

// // ======================
// // Email Configuration
// // ======================

// const transporter =
//   nodemailer.createTransport({

//     service: "gmail",

//     auth: {

//       user:
//         "omini.truebulksms@gmail.com",

//       pass:
//         "pswn utnf rwid swip"
//     }
//   });

// // ======================
// // Response Helper
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

//     body:
//       JSON.stringify(body)
//   };
// };

// // ======================
// // Email Validation
// // ======================

// const isValidEmail = (
//   email
// ) => {

//   return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
//     .test(email);
// };

// // ======================
// // Generate OTP
// // ======================

// const generateOTP = () => {

//   return Math.floor(
//     100000 +
//     Math.random() * 900000
//   ).toString();
// };

// // ======================
// // Forgot Password API
// // ======================

// export const handler =
//   async (event) => {

//     try {

//       // ======================
//       // Parse Request
//       // ======================

//       let { email } = event;

//       // ======================
//       // Validation
//       // ======================

//       if (!email) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "email is required"
//           }
//         );
//       }

//       email =
//         email.toLowerCase().trim();

//       if (
//         !isValidEmail(email)
//       ) {

//         return sendResponse(
//           400,
//           {
//             message:
//               "Invalid email format"
//           }
//         );
//       }

//       // ======================
//       // Check User Exists
//       // ======================

//       const result =
//         await docClient.send(

//           new GetCommand({

//             TableName:
//               TABLE_NAME,

//             Key: {
//               id: email
//             }
//           })
//         );

//       const user =
//         result.Item;

//       // ======================
//       // Do not reveal
//       // whether account exists
//       // Industry Practice
//       // ======================

//       if (!user) {

//         return sendResponse(
//           200,
//           {
//             message:
//               "If an account exists with this email, an OTP has been sent."
//           }
//         );
//       }

//       // ======================
//       // Generate OTP
//       // ======================

//       const otp =
//         generateOTP();

//       // ======================
//       // Hash OTP
//       // ======================

//       const hashedOtp =
//         await bcrypt.hash(
//           otp,
//           10
//         );

//       // ======================
//       // OTP Expiry
//       // 10 minutes
//       // ======================

//       const otpExpiry =
//         Date.now() +
//         10 * 60 * 1000;

//       // ======================
//       // Save OTP in DB
//       // ======================

//       await docClient.send(

//         new UpdateCommand({

//           TableName:
//             TABLE_NAME,

//           Key: {
//             id: email
//           },

//           UpdateExpression:
//             `
//             SET
//             forgotPasswordOtp = :otp,
//             forgotPasswordOtpExpiry = :expiry,
//             updatedAt = :updatedAt
//             `,

//           ExpressionAttributeValues: {

//             ":otp":
//               hashedOtp,

//             ":expiry":
//               otpExpiry,

//             ":updatedAt":
//               new Date().toISOString()
//           }
//         })
//       );

//       // ======================
//       // Send Email
//       // ======================

//       await transporter.sendMail({

//         from:
//           "example@gmail.com",

//         to:
//           email,

//         subject:
//           "Password Reset OTP",

//         html: `

//         <div
//           style="
//             font-family:
//             Arial,
//             sans-serif;
//             max-width:
//             600px;
//             margin:auto;
//             padding:20px;
//             border:1px solid #ddd;
//             border-radius:8px;
//           "
//         >

//           <h2>
//             Password Reset Request
//           </h2>

//           <p>
//             Hello,
//           </p>

//           <p>
//             We received a request
//             to reset your account
//             password.
//           </p>

//           <p>
//             Please use the OTP
//             below to continue:
//           </p>

//           <div
//             style="
//               font-size:32px;
//               font-weight:bold;
//               letter-spacing:6px;
//               margin:20px 0;
//               color:#2c3e50;
//             "
//           >
//             ${otp}
//           </div>

//           <p>
//             This OTP is valid for
//             <b>10 minutes</b>.
//           </p>

//           <p>
//             If you did not request
//             a password reset,
//             please ignore this email.
//           </p>

//           <br>

//           <p>
//             Regards,
//             <br>
//             Support Team
//           </p>

//         </div>
//         `
//       });

//       // ======================
//       // Success Response
//       // ======================

//       return sendResponse(
//         200,
//         {
//           message:
//             "If an account exists with this email, an OTP has been sent."
//         }
//       );

//     } catch (error) {

//       console.error(
//         "Forgot Password Error:",
//         error
//       );

//       return sendResponse(
//         500,
//         {
//           message:
//             "Internal server error",

//           error:
//             error.message
//         }
//       );
//     }
// };