import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import { generate } from "./utils";
import { getAllFiles } from "./file";
import path from "path";
import { uploadFile, createFolder } from "./aws";
import { createClient } from "redis";
const publisher = createClient();
publisher.connect();

const subscriber = createClient();
subscriber.connect();

const app = express();
app.use(cors())
app.use(express.json());

app.post("/deploy", async (req, res) => {
    try {
        const repoUrl = req.body.repoUrl;
        const id = generate(); // asd12

        console.log(`Starting deployment with ID: ${id}`);

        // Create both folders explicitly
        console.log("Creating S3 folders...");
        await createFolder('output');
        await createFolder(`output/${id}`);
        console.log("S3 folders created successfully");

        // Clone the repository
        console.log("Cloning repository...");
        await simpleGit().clone(repoUrl, path.join(__dirname, `output/${id}`));

        const files = getAllFiles(path.join(__dirname, `output/${id}`));
        console.log(`Found ${files.length} files to upload`);

        // Upload all files with proper path structure
        const uploadPromises = files.map(async file => {
            const relativePath = path.relative(
                path.join(__dirname, 'output', id),
                file
            );
            return uploadFile(id, relativePath, file);
        });

        // Wait for all uploads to complete
        console.log("Uploading files...");
        await Promise.all(uploadPromises);
        console.log("All files uploaded successfully");

        await new Promise((resolve) => setTimeout(resolve, 5000))
        
        publisher.lPush("build-queue", id);
        publisher.hSet("status", id, "uploaded");

        res.json({
            id: id,
            message: "Deployment started successfully"
        });
    } catch (error) {
        console.error('Deploy error:', error);
        res.status(500).json({ 
            error: 'Deployment failed',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

app.get("/status", async (req, res) => {
    const id = req.query.id;
    const response = await subscriber.hGet("status", id as string);
    res.json({
        status: response
    })
})

app.listen(3000);