const express = require('express');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');
const mongoose = require('mongoose');

// Initialize Express app
const app = express();
app.use(cors());
const port = process.env.PORT || 3000;
const uploadDir = 'uploads';

// Create the uploads directory if it doesn’t exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Multer to save files temporarily in the 'uploads' directory
const upload = multer({ dest: 'uploads/' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

// Define File Schema
const fileSchema = new mongoose.Schema({
    filename: { type: String, required: true },
    contentType: { type: String, required: true },
    fileData: { type: Buffer, required: true }, // Stores file content as Buffer
    uploadDate: { type: Date, default: Date.now },
});

const File = mongoose.model('File', fileSchema);

// Function to save file to MongoDB
async function saveFileToMongo(fileName, localFilePath) {
    try {
        const fileContent = fs.readFileSync(localFilePath);
        const newFile = new File({
            filename: fileName,
            contentType: 'application/octet-stream', // Adjust based on file type if needed
            fileData: fileContent,
        });
        const savedFile = await newFile.save();
        console.log('File saved to MongoDB:', savedFile);
        return savedFile;
    } catch (error) {
        console.error('Error saving to MongoDB:', error);
        throw error;
    } finally {
        // Clean up local file
        fs.unlinkSync(localFilePath);
    }
}

app.get('/', (req, res) => {
    res.json({ message: "server started" });
});

// Handle POST request to '/upload'
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log('File uploaded locally:', req.file);
    try {
        await saveFileToMongo(req.file.originalname, req.file.path);
        res.send('File uploaded successfully to MongoDB');
    } catch (error) {
        res.status(500).send('Error uploading to MongoDB');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
