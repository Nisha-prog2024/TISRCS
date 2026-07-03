const { LambdaClient, ListFunctionsCommand, GetFunctionCommand } = require("@aws-sdk/client-lambda");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const AdmZip = require("adm-zip");

// =============================
// AWS CONFIG
// =============================
const client = new LambdaClient({
    region: "ap-south-1", // Change if required
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const DOWNLOAD_DIR = path.join(__dirname, "lambda-backups");

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR);
}

// =============================
// Get all Lambda Functions
// =============================
async function getAllFunctions() {

    let functions = [];
    let Marker;

    do {

        const response = await client.send(
            new ListFunctionsCommand({
                Marker
            })
        );

        functions.push(...response.Functions);

        Marker = response.NextMarker;

    } while (Marker);

    return functions;
}

// =============================
// Download + Extract Lambda
// =============================
async function downloadLambda(functionName) {

    try {

        const response = await client.send(
            new GetFunctionCommand({
                FunctionName: functionName
            })
        );

        const url = response.Code.Location;

        const zipResponse = await axios({
            method: "GET",
            url,
            responseType: "stream"
        });

        const filePath = path.join(
            DOWNLOAD_DIR,
            `${functionName}.zip`
        );

        const writer = fs.createWriteStream(filePath);

        zipResponse.data.pipe(writer);

        return new Promise((resolve, reject) => {

            writer.on("finish", () => {

                console.log(`Downloaded : ${functionName}`);

                const extractFolder = path.join(
                    DOWNLOAD_DIR,
                    functionName
                );

                if (!fs.existsSync(extractFolder)) {
                    fs.mkdirSync(extractFolder);
                }

                const zip = new AdmZip(filePath);

                zip.extractAllTo(
                    extractFolder,
                    true
                );

                console.log(`Extracted : ${functionName}`);

                // Delete ZIP after extraction
                fs.unlinkSync(filePath);

                console.log(`Deleted ZIP : ${functionName}`);

                resolve();

            });

            writer.on("error", reject);

        });

    }
    catch (err) {

        console.log(functionName);

        console.log(err.message);

    }

}

// =============================
// Backup All RCS Lambdas
// =============================
async function backup() {

    const functions = await getAllFunctions();

    const rcsFunctions = functions.filter(f =>
        f.FunctionName.startsWith("rcs")
    );

    console.log(`Found ${rcsFunctions.length} RCS Lambdas`);

    for (const fn of rcsFunctions) {

        await downloadLambda(fn.FunctionName);

    }

    console.log("Backup Completed");

}

backup();