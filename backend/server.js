const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sanitize = require('sanitize-filename');
require('dotenv').config();
const webSocketService = require('./websocketService');

const app = express();
const PORT = process.env.PORT || 3010;
const HOST = process.env.HOST || 'localhost';

// Security Headers
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiting (DISABLED)
// const limiter = rateLimit({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // Limit each IP to 100 requests per windowMs
//     message: 'Too many requests from this IP, please try again later.'
// });
// app.use(limiter);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50gb' }));
app.use(express.urlencoded({ limit: '50gb', extended: true }));

// Cleanup function for old temp files (runs every hour)
const cleanupTempFiles = () => {
    const tempDir = path.join(__dirname, 'uploads', 'temp');
    if (fs.existsSync(tempDir)) {
        fs.readdir(tempDir, (err, files) => {
            if (err) return console.error('Error reading temp dir:', err);
            
            const now = Date.now();
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    
                    // Remove files older than 24 hours
                    if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
                        fs.rm(filePath, { recursive: true, force: true }, (err) => {
                            if (err) console.error('Error deleting old temp file:', filePath);
                            else console.log('Cleaned up old temp file:', filePath);
                        });
                    }
                });
            });
        });
    }
};
// Run cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);


// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create unique filename: timestamp + random + extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: Infinity // Unlimited file size
    },
    fileFilter: (req, file, cb) => {
        // Allow all file types as requested
        console.log(`[Upload] Processing file: ${file.originalname} (ext: ${path.extname(file.originalname)}, mime: ${file.mimetype})`);
        cb(null, true);
    }
});

// Helper function to merge chunks
const mergeChunks = async (fileName, totalChunks) => {
    const chunkDir = path.join(uploadDir, 'temp', fileName);
    const mergedFilePath = path.join(uploadDir, fileName);

    const writeStream = fs.createWriteStream(mergedFilePath);

    for (let i = 0; i < totalChunks; i++) {
        const chunkPath = path.join(chunkDir, `chunk-${i}`);
        const chunkBuffer = fs.readFileSync(chunkPath);
        writeStream.write(chunkBuffer);
        fs.unlinkSync(chunkPath); // Remove chunk after merging
    }

    writeStream.end();
    fs.rmdirSync(chunkDir); // Remove temp dir
    
    return mergedFilePath;
};

// Chunked upload endpoint
const chunkUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            let fileName = req.body.fileName;
            if (!fileName) {
                return cb(new Error('fileName is missing in request body. Ensure text fields are sent before file in FormData.'));
            }
            
            // Sanitize filename to prevent directory traversal
            fileName = sanitize(fileName);
            if (fileName.length === 0) {
                 return cb(new Error('Invalid filename'));
            }
            
            // Re-assign sanitized name back to body so subsequent middleware/handlers use the safe version
            req.body.fileName = fileName;

            const tempDir = path.join(uploadDir, 'temp', fileName);
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            cb(null, tempDir);
        },
        filename: (req, file, cb) => {
            // Sanitize chunk index just in case, though usually it's a number
            const chunkIndex = sanitize(req.body.chunkIndex || '');
            cb(null, `chunk-${chunkIndex}`);
        }
    }),
    fileFilter: (req, file, cb) => {
        // Allow all file types as requested
        cb(null, true);
    }
});

app.post('/upload-chunk', chunkUpload.single('chunk'), async (req, res) => {
    try {
        const { chunkIndex, totalChunks, fileName } = req.body;
        const currentChunk = parseInt(chunkIndex);
        const total = parseInt(totalChunks);

        console.log(`Received chunk ${currentChunk + 1}/${total} for file ${fileName}`);

        if (currentChunk === total - 1) {
            // Last chunk received, merge files
            console.log('Last chunk received. Merging...');
            
            // Wait a bit to ensure file handle is released
            setTimeout(async () => {
                try {
                    await mergeChunks(fileName, total);
                    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${fileName}`;
                    
                    res.json({
                        message: 'File uploaded and merged successfully',
                        filename: fileName,
                        url: fileUrl,
                        completed: true
                    });
                } catch (error) {
                    console.error('Error merging chunks:', error);
                    res.status(500).json({ error: 'Error merging file chunks' });
                }
            }, 500);
        } else {
            res.json({
                message: 'Chunk uploaded successfully',
                chunkIndex: currentChunk,
                completed: false
            });
        }
    } catch (error) {
        console.error('Error in chunk upload:', error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Routes
app.get('/', (req, res) => {
    res.json({ message: 'Backend is running' });
});

// Upload endpoint for photos and videos
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    res.json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        url: fileUrl,
        mimetype: req.file.mimetype,
        size: req.file.size
    });
});

// Serve static files from uploads directory
app.use('/uploads', express.static(uploadDir));

// Start server
const server = app.listen(PORT, HOST, () => {
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`Uploads directory: ${uploadDir}`);
});

// Initialize WebSocket
webSocketService.initialize(server);
