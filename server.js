require('dotenv').config(); // Load environment variables from .env
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const AWS = require('aws-sdk');
const mongoose = require('mongoose');
const path = require('path');

// Initialize Express app
const app = express();
app.use(cors());

const port = process.env.PORT || 3000;
const uploadDir = path.join(__dirname, 'uploads');

// Create the uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Multer to store files temporarily in the uploads folder
const upload = multer({ dest: uploadDir + '/' });

// Configure AWS SDK to use Cloudflare R2
const R2CONFIG = {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT, // Should include the bucket name as a part of the URL if required
    apiVersion: 'latest',
    region: 'auto',
    signatureVersion: 'v3'
};
AWS.config.update(R2CONFIG);
const s3 = new AWS.S3();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('MongoDB connection error:', err));

// Define a Mongoose schema to store file details and content
const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    fileData: { type: Buffer, required: true },
    uploadDate: { type: Date, default: Date.now },
});
const File = mongoose.model('File', fileSchema);

// Function to upload file to Cloudflare R2 using AWS S3 methods
async function uploadFileToR2(fileName, localFilePath) {
    const fileStats = fs.statSync(localFilePath);

    if (fileStats.size < 20242880) { // For files smaller than 5MB
        const fileContent = fs.readFileSync(localFilePath);
        const params = {
            Bucket: "logcapture", // Change this if your bucket name is different
            Key: fileName,
            Body: fileContent,
        };
        try {
            const data = await s3.putObject(params).promise();
            console.log('File uploaded mongo + cloudflare');
           
            return data;
        } catch (err) {
            console.error('Error uploading small file:', err);
            throw err;
        }
    } else { // For larger files, stream the content
        const params = {
            Bucket: "logcapture",
            Key: fileName,
            Body: fs.createReadStream(localFilePath),
        };
        try {
            const data = await s3.upload(params).promise();
            console.log('File uploaded (large file):');
            return data;
        } catch (err) {
            console.error('Error uploading large file:', err);
            throw err;
        }
    }
}

// Function to save file content to MongoDB
async function saveFileToMongo(fileName, localFilePath) {
    try {
        const fileContent = fs.readFileSync(localFilePath);
        const newFile = new File({
            filename: fileName,
            contentType: 'application/octet-stream', // Adjust if you want to save the correct MIME type
            fileData: fileContent,
        });
        const savedFile = await newFile.save();
        console.log('File saved to MongoDB:', savedFile);
        return savedFile;
    } catch (error) {
        console.error('Error saving to MongoDB:', error);
        throw error;
    } finally {
        // Remove the local file after processing
        fs.unlinkSync(localFilePath);
    }
}

// A simple root endpoint
app.get('/', (req, res) => {
    res.json({ message: "server started" });
});

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log('File uploaded locally:', req.file);
    try {
        // Upload to Cloudflare R2
        await uploadFileToR2(req.file.originalname, req.file.path);
        // Save file copy to MongoDB
        await saveFileToMongo(req.file.originalname, req.file.path);
        res.send('File uploaded successfully to MongoDB and cloudflare');
    } catch (error) {
        res.status(500).send('Error uploading to MongoDB');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

