import { S3 } from "aws-sdk";
import fs from "fs";
import path from "path";

const s3 = new S3({
    accessKeyId: "accesskey",
    secretAccessKey: "secretkey"
})

export const createFolder = async (folderName: string) => {
    try {
        // Create an empty object with a trailing slash to represent a folder
        await s3.putObject({
            Bucket: "bucket-name",
            Key: `${folderName}/`,
            Body: ''
        }).promise();
        console.log(`Created folder: ${folderName}/`);
    } catch (error) {
        console.error(`Error creating folder ${folderName}:`, error);
        throw error;
    }
}

export const uploadFile = async (id: string, fileName: string, localFilePath: string) => {
    try {
        const fileContent = fs.readFileSync(localFilePath);
        
        // First ensure both folders exist
        await createFolder('output');
        await createFolder(`output/${id}`);
        
        // Then upload the file
        const s3Key = `output/${id}/${fileName}`;
        
        const response = await s3.upload({
            Body: fileContent,
            Bucket: "bucket-name",
            Key: s3Key,
        }).promise();
        console.log(`Uploaded to: ${s3Key}`);
    } catch (error) {
        console.error(`Error uploading file ${fileName}:`, error);
        throw error;
    }
}