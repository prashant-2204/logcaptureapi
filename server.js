const express = require('express');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();
const fs = require('fs');

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;
const uploadDir = 'uploads';

// Create the uploads directory if it doesn’t exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure Multer to save files in the 'uploads' directory
const upload = multer({ dest: 'uploads/' });

app.get('/',(req, res)=>
{
   res.json({message:"server started"});
})

// Handle POST request to '/upload'
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    console.log('File uploaded:', req.file);
    res.send('File uploaded successfully');
});

// Start the server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});