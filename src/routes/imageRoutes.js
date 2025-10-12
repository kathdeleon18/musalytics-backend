// backend/src/routes/imageRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file uploads (as a fallback)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueId = uuidv4();
        const extension = path.extname(file.originalname);
        cb(null, uniqueId + extension);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: function (req, file, cb) {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Only JPEG and PNG images are allowed'));
        }
        cb(null, true);
    }
});

// In-memory database for images (replace with real database in production)
if (!global.imagesDb) {
    global.imagesDb = [];
}

// Handle Firebase URL uploads (JSON body)
router.post('/images/upload', express.json(), async (req, res) => {
    // If there's a firebaseUrl in the request body, process it as a Firebase upload
    if (req.body && req.body.firebaseUrl) {
        try {
            // Firebase URL upload
            const firebaseUrl = req.body.firebaseUrl;
            const imageId = uuidv4();
            
            // Parse metadata if provided
            let metadata = {};
            try {
                metadata = typeof req.body.metadata === 'string' 
                    ? JSON.parse(req.body.metadata) 
                    : req.body.metadata || {};
            } catch (err) {
                console.error('Error parsing metadata:', err);
            }
            
            const fileName = metadata.fileName || 'unknown.jpg';
            
            console.log(`Registered Firebase image: ${imageId}, URL: ${firebaseUrl}`);

            // Create a record in the database
            const analysisId = uuidv4();
            const timestamp = new Date().toISOString();
            
            // Store image info
            const imageRecord = {
                imageId,
                firebaseUrl,
                fileName,
                filePath: null,
                metadata,
                uploadedAt: timestamp,
                userId: metadata.userId || null
            };
            
            global.imagesDb.push(imageRecord);
            
            // Return success response
            return res.status(200).json({
                success: true,
                imageId,
                analysisId,
                fileName,
                uploadedAt: timestamp
            });
        } catch (err) {
            console.error('Error registering Firebase image:', err);
            return res.status(500).json({ error: 'Failed to register Firebase image', details: err.message });
        }
    } else {
        // If no firebaseUrl, pass to the next handler (multipart upload)
        next();
    }
});

// Handle direct file uploads (multipart/form-data)
router.post('/images/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }

        // Direct file upload
        const imageId = req.file.filename;
        const fileName = req.file.originalname;
        
        // Parse metadata if provided
        let metadata = {};
        try {
            metadata = req.body.metadata ? JSON.parse(req.body.metadata) : {};
        } catch (err) {
            console.error('Error parsing metadata:', err);
        }
        
        console.log(`Uploaded file directly: ${imageId}, Path: ${req.file.path}`);

        // Create a record in the database
        const analysisId = uuidv4();
        const timestamp = new Date().toISOString();
        
        // Store image info
        const imageRecord = {
            imageId,
            firebaseUrl: null,
            fileName,
            filePath: req.file.path,
            metadata,
            uploadedAt: timestamp,
            userId: metadata.userId || null
        };
        
        global.imagesDb.push(imageRecord);
        
        // Return success response
        res.status(200).json({
            success: true,
            imageId,
            analysisId,
            fileName,
            uploadedAt: timestamp
        });
    } catch (err) {
        console.error('Error uploading image:', err);
        res.status(500).json({ error: 'Failed to upload image', details: err.message });
    }
});

// Get image by ID
router.get('/images/:id', (req, res) => {
    const imageId = req.params.id;
    
    // Find image in database
    const image = global.imagesDb.find(img => img.imageId === imageId);
    
    if (image) {
        // Return image info
        res.status(200).json({
            imageId: image.imageId,
            fileName: image.fileName,
            filePath: image.filePath,
            firebaseUrl: image.firebaseUrl,
            uploadedAt: image.uploadedAt
        });
    } else if (fs.existsSync(path.join(__dirname, '../../uploads', imageId))) {
        // Fallback to check if file exists in uploads directory
        const imagePath = path.join(__dirname, '../../uploads', imageId);
        res.status(200).json({
            imageId: imageId,
            filePath: imagePath,
            fileName: imageId,
            uploadedAt: fs.statSync(imagePath).mtime
        });
    } else {
        res.status(404).json({ error: 'Image not found' });
    }
});

// Serve image files (for local files)
router.get('/images/file/:id', (req, res) => {
    const imageId = req.params.id;
    
    // Find image in database
    const image = global.imagesDb.find(img => img.imageId === imageId);
    
    if (image && image.firebaseUrl) {
        // Redirect to Firebase URL if available
        return res.redirect(image.firebaseUrl);
    } else if (image && image.filePath && fs.existsSync(image.filePath)) {
        // Serve local file if available
        return res.sendFile(image.filePath);
    } else if (fs.existsSync(path.join(__dirname, '../../uploads', imageId))) {
        // Fallback to check if file exists in uploads directory
        const imagePath = path.join(__dirname, '../../uploads', imageId);
        return res.sendFile(imagePath);
    } else {
        return res.status(404).json({ error: 'Image not found' });
    }
});

module.exports = router;