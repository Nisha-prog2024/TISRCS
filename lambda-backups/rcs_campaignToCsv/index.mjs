import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand
} from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: "ap-south-1" });
const BUCKET = "rcs-main";

// -----------------------------
// STREAM → STRING
// -----------------------------
const streamToString = async (stream) => {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (chunk) => chunks.push(chunk));
        stream.on("error", reject);
        stream.on("end", () => {
            resolve(Buffer.concat(chunks).toString("utf-8"));
        });
    });
};

// -----------------------------
// SAFE KEY EXTRACTION
// -----------------------------
const getKeyFromUrl = async (url) => {
    const parsed = new URL(url);

    const originalKey = parsed.pathname.slice(1);

    const possibleKeys = [
        originalKey,
        decodeURIComponent(originalKey),
        originalKey.replace(/\+/g, " ")
    ];

    for (const key of possibleKeys) {
        try {
            console.log("Trying key:", key);

            await s3.send(new GetObjectCommand({
                Bucket: BUCKET,
                Key: key
            }));

            console.log("Found key:", key);
            return key;

        } catch (err) {
            // try next
        }
    }

    throw new Error("S3 key not found for given URL");
};


// -----------------------------
// NUMBER VALIDATION
// -----------------------------
const normalizeNumber = (num) => {
    if (!num) return null;

    let cleaned =
        num.toString().replace(/\D/g, "");

    // remove 91 only if actual country code
    if (
        cleaned.length === 12 &&
        cleaned.startsWith("91")
    ) {

        cleaned = cleaned.slice(2);
    }

    // validate indian mobile
    if (
        /^[6-9]\d{9}$/.test(cleaned)
    ) {

        return cleaned;
    }

    return null;
};

// -----------------------------
// CSV PARSER
// -----------------------------
const parseCSV = (csvText) => {
    const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) return [];

    const numbers = [];

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        if (!cols[0]) continue;
        numbers.push(cols[0].trim());
    }

    return numbers;
};

// -----------------------------
// MAIN HANDLER
// -----------------------------
export const handler = async (event) => {
    try {
        const { campaignName, numbers, message, bot, fileUrl } = event;

        let finalNumbers = [];
        let invalidNumbers = [];

        // =====================================================
        // QUICK FLOW
        // =====================================================
        if (numbers && numbers.length > 0) {
            numbers.forEach(num => {
                const normalized = normalizeNumber(num);
                if (!normalized) invalidNumbers.push(num);
                else finalNumbers.push(normalized);
            });
        }

        // =====================================================
        // BULK FLOW (READ CSV FROM S3)
        // =====================================================
        if (fileUrl) {

            const key = await getKeyFromUrl(fileUrl);

            const file = await s3.send(new GetObjectCommand({
                Bucket: BUCKET,
                Key: key
            }));

            const csvText = await streamToString(file.Body);

            const fileNumbers = parseCSV(csvText);

            fileNumbers.forEach(num => {
                const normalized = normalizeNumber(num);
                if (!normalized) invalidNumbers.push(num);
                else finalNumbers.push(normalized);
            });
        }

        // =====================================================
        // STOP IF INVALID
        // =====================================================
        if (invalidNumbers.length > 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Invalid numbers found,campaign can't be created, remove invalid numbers",
                    invalidNumbers
                })
            };
        }

        // remove duplicates
        finalNumbers = [...new Set(finalNumbers)];

        if (finalNumbers.length === 0) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "No valid numbers found"
                })
            };
        }

        // =====================================================
        // CREATE CLEAN CSV
        // =====================================================
        let csv = "phone,message,bot\n";

        finalNumbers.forEach(num => {
            csv += `${num},"${message}",${bot}\n`;
        });

        const key = `campaign/${Date.now()}-${campaignName}.csv`;

        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: csv,
            ContentType: "text/csv"
        }));

        const csvUrl = `https://${BUCKET}.s3.ap-south-1.amazonaws.com/${key}`;

        return {
            statusCode: 200,
            body: JSON.stringify({
                csvUrl,
                numbers: finalNumbers
            })
        };

    } catch (err) {
        console.error(err);

        return {
            statusCode: 500,
            body: JSON.stringify({
                message: err.message
            })
        };
    }
};