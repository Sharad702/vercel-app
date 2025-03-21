import { exec } from "child_process";
import path from "path";
import fs from "fs";

export function buildProject(id: string) {
    return new Promise((resolve) => {
        const projectPath = path.join(__dirname, `output/${id}`);
        
        // Check if package.json exists
        if (!fs.existsSync(path.join(projectPath, 'package.json'))) {
            console.log('No package.json found, treating as static site');
            // Create dist directory
            const distPath = path.join(projectPath, 'dist');
            if (!fs.existsSync(distPath)) {
                fs.mkdirSync(distPath, { recursive: true });
            }
            
            // Copy all static files to dist
            fs.readdirSync(projectPath).forEach(file => {
                if (file.match(/\.(html|css|js|jpg|jpeg|png|gif|svg)$/i)) {
                    fs.copyFileSync(
                        path.join(projectPath, file),
                        path.join(distPath, file)
                    );
                }
            });
            resolve("");
            return;
        }

        // If package.json exists, proceed with npm build
        const child = exec(`cd ${projectPath} && npm install && npm run build`);

        child.stdout?.on('data', function(data) {
            console.log('stdout: ' + data);
        });
        child.stderr?.on('data', function(data) {
            console.log('stderr: ' + data);
            
            // If build script is missing, create dist directory and copy files
            if (data.includes("Missing script: \"build\"")) {
                console.log('No build script found, treating as static site');
                const distPath = path.join(projectPath, 'dist');
                if (!fs.existsSync(distPath)) {
                    fs.mkdirSync(distPath, { recursive: true });
                }
                
                // Copy all static files to dist
                fs.readdirSync(projectPath).forEach(file => {
                    if (file.match(/\.(html|css|js|jpg|jpeg|png|gif|svg)$/i)) {
                        fs.copyFileSync(
                            path.join(projectPath, file),
                            path.join(distPath, file)
                        );
                    }
                });
            }
        });

        child.on('close', function(code) {
            resolve("");
        });
    });
}