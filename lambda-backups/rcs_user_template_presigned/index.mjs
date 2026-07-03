import { S3 } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const bucket = "rcs-main";

// Function to determine Content-Type based on file extension
function getContentType(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();

    const contentTypes = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "gif": "image/gif",
        "webp": "image/webp",
        "pdf": "application/pdf",

        //  videos
        "mp4": "video/mp4",
        "mov": "video/quicktime",
        "avi": "video/x-msvideo",
        "mkv": "video/x-matroska",
        "webm": "video/webm"
    };

    return contentTypes[extension] || "application/octet-stream"; // Default for unknown types
}

export const handler = async (event) => {
    try {
        console.log(event);

        const fileName = event["fileName"];

        // Validate 'fileName' field
        if (!fileName) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: "fileName not found" }),
            };
        }

        const uploadDetails = [];

        const decodedFileName = decodeURI(fileName);
        console.log(decodedFileName);

        const id = `id${Math.floor(Math.random() * (99999999 - 10000000 + 1) + 10000000)}`;
        console.log(id);

        const key = `template/cards/${id}_${decodedFileName}`;
        const contentType = getContentType(decodedFileName);

        const url = await getSignedUrl(
            new S3({}),
            new PutObjectCommand({
                Bucket: bucket,
                Key: key,
               // ContentType: contentType,
            }),
            { expiresIn: 600 }
        );

        console.log("S3 Key:", key);
        console.log("Signed URL:", url);

        uploadDetails.push({
            fileName: decodedFileName,
            key: `https://${bucket}.s3.ap-south-1.amazonaws.com/${key}`,
            signedUrl: url,
            
        });

        return {
            statusCode: 200,
            body: ({ uploadDetails: uploadDetails }),
        };
    } catch (e) {
        console.error(e);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: e.message }),
        };
    }
};
