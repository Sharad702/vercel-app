import { S3 } from "aws-sdk";
import fs from "fs";
import path from "path";

// SECURITY WARNING: Never commit AWS credentials directly in code
// Use environment variables instead

const s3 = new S3({
    accessKeyId: "accessid",
    secretAccessKey: "secretkey"
})
const BUCKET_NAME = "bucket-name";

// output/asdasd
export async function downloadS3Folder(prefix: string) {
    try {
        const searchPrefix = prefix;
        console.log("Starting download from S3 with prefix:", searchPrefix);
        
        const allFiles = await s3.listObjectsV2({
            Bucket: BUCKET_NAME,
            Prefix: searchPrefix
        }).promise();
        
        console.log("Files found in S3:", allFiles.Contents?.map(x => x.Key));
        
        if (!allFiles.Contents || allFiles.Contents.length === 0) {
            const alternativePrefix = `output\\${prefix.split('/').pop()}`;
            console.log("Trying alternative prefix:", alternativePrefix);
            
            const alternativeFiles = await s3.listObjectsV2({
                Bucket: BUCKET_NAME,
                Prefix: alternativePrefix
            }).promise();
            
            if (!alternativeFiles.Contents || alternativeFiles.Contents.length === 0) {
                throw new Error(`No files found in S3 with prefix: ${searchPrefix} or ${alternativePrefix}`);
            }
            
            allFiles.Contents = alternativeFiles.Contents;
        }
        
        const allPromises = allFiles.Contents
            // Filter out directory entries (they end with /)
            .filter(({Key}) => Key && !Key.endsWith('/'))
            .map(async ({Key}) => {
                return new Promise(async (resolve, reject) => {
                    if (!Key) {
                        resolve("");
                        return;
                    }

                    try {
                        const finalOutputPath = path.join(__dirname, Key);
                        const dirName = path.dirname(finalOutputPath);
                        
                        console.log(`Creating directory: ${dirName}`);
                        if (!fs.existsSync(dirName)){
                            fs.mkdirSync(dirName, { recursive: true });
                        }

                        const outputFile = fs.createWriteStream(finalOutputPath);
                        s3.getObject({
                            Bucket: BUCKET_NAME,
                            Key
                        }).createReadStream()
                          .pipe(outputFile)
                          .on("finish", () => {
                              console.log(`Downloaded: ${Key} to ${finalOutputPath}`);
                              resolve("");
                          })
                          .on("error", (error) => reject(error));
                    } catch (error) {
                        console.error(`Error processing file ${Key}:`, error);
                        reject(error);
                    }
                });
            });

        await Promise.all(allPromises);
        console.log("All files downloaded successfully");
    } catch (error) {
        console.error("Error downloading from S3:", error);
        throw error;
    }
}

export function copyFinalDist(id: string) {
    try {
        // Look for the dist folder inside the project directory
        const folderPath = path.join(__dirname, 'output', id, 'dist');
        console.log("Looking for dist files in:", folderPath);
        
        if (!fs.existsSync(folderPath)) {
            throw new Error(`Dist directory not found: ${folderPath}`);
        }

        const allFiles = getAllFiles(folderPath);
        console.log("Found files to upload:", allFiles);
        
        return Promise.all(allFiles.map(file => {
            // Create the correct S3 key for the dist files
            const relativePath = path.relative(folderPath, file);
            const s3Key = `dist/${id}/${relativePath}`;
            console.log(`Uploading ${file} to ${s3Key}`);
            return uploadFile(s3Key, file);
        }));
    } catch (error) {
        console.error("Error copying final dist:", error);
        throw error;
    }
}

const getAllFiles = (folderPath: string): string[] => {
    try {
        let response: string[] = [];
        const allFilesAndFolders = fs.readdirSync(folderPath);
        
        allFilesAndFolders.forEach(file => {
            const fullFilePath = path.join(folderPath, file);
            if (fs.statSync(fullFilePath).isDirectory()) {
                response = response.concat(getAllFiles(fullFilePath));
            } else {
                response.push(fullFilePath);
            }
        });
        return response;
    } catch (error) {
        console.error("Error getting all files:", error);
        throw error;
    }
}

const uploadFile = async (fileName: string, localFilePath: string) => {
    try {
        const fileContent = fs.readFileSync(localFilePath);
        const response = await s3.upload({
            Body: fileContent,
            Bucket: BUCKET_NAME,
            Key: fileName,
        }).promise();
        console.log(`Successfully uploaded: ${fileName}`);
        return response;
    } catch (error) {
        console.error(`Error uploading file ${fileName}:`, error);
        throw error;
    }
}

// Helper function to determine content type
function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const contentTypes: Record<string, string> = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
    };
    return contentTypes[ext] || 'application/octet-stream';
}