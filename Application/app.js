require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Storage } = require('@google-cloud/storage');
const path = require('path');
const multer = require('multer');
const admin = require('firebase-admin');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 3000;

// Google Cloud Storage setup
const storage = new Storage({
    keyFilename: process.env.GCP_KEYFILE_PATH,
});
const mainBucket = storage.bucket(process.env.GCP_BUCKET_MAIN);
const tempBucket = storage.bucket(process.env.GCP_BUCKET_TEMPORARY);

// Middleware
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.set('view engine', 'ejs');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

// Firebase Admin SDK setup
admin.initializeApp({
    credential: admin.credential.cert(require(process.env.GCP_KEYFILE_PATH)),
    databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.firestore();

// Check and return the JWT secret key
const getJwtSecret = () => {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined in .env file");
    }
    return process.env.JWT_SECRET;
};

app.get('/', async (req, res) => {
    const token = req.cookies.token;
    let loggedIn = false;
    let files = [];
    let username = null;

    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            loggedIn = true;
            username = decoded.username; // Store the username from the token
        } catch (err) {
            console.error('Token is invalid, user is not logged in');
        }
    }

    try {
        [files] = await mainBucket.getFiles();
        files = files.map(file => ({
            name: file.name,
            lastModified: file.metadata.updated,
            size: file.metadata.size,
            url: `https://storage.googleapis.com/${mainBucket.name}/${file.name}`
        }));
    } catch (error) {
        console.error('Error fetching files:', error);
    }

    res.render('index', { loggedIn, files, username }); // Pass username to the template
});

app.get('/download/:filename', async (req, res) => {
    const filename = req.params.filename;
    const file = mainBucket.file(filename);

    try {
        const [metadata] = await file.getMetadata();
        res.setHeader('Content-Type', metadata.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        file.createReadStream()
            .on('error', function (err) {
                console.error('Error downloading file:', err);
                res.status(500).send('Error downloading file');
            })
            .pipe(res);
    } catch (error) {
        console.error('Error getting file metadata:', error);
        res.status(404).send('File not found');
    }
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        await db.collection('Users').add({
            username: username,
            password: hashedPassword
        });

        res.redirect('/login');
    } catch (error) {
        console.error('Error saving user:', error);
        res.status(500).send('Error registering user');
    }
});

app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const usersRef = db.collection('Users');
        const snapshot = await usersRef.where('username', '==', username).get();

        if (snapshot.empty) {
            return res.render('login', { error: 'Invalid credentials' });
        }

        const user = snapshot.docs[0].data();

        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ username: user.username }, getJwtSecret(), { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true });
            res.redirect('/');
        } else {
            res.render('login', { error: 'Invalid credentials' });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(500).send('Error logging in');
    }
});

app.get('/upload', (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, getJwtSecret(), (err) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.redirect('/login');
        }

        const success = req.query.success;
        const error = req.query.error;
        res.render('upload', { success, error });
    });
});

app.post('/upload', upload.single('file'), async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.redirect('/login');
    }

    jwt.verify(token, getJwtSecret(), async (err, decoded) => {
        if (err) {
            console.error('Token verification failed:', err);
            return res.redirect('/login');
        }

        if (!req.file) {
            return res.render('upload', { error: 'No file uploaded' });
        }

        const userName = decoded.username;
        const fileName = req.file.originalname;
        const timestamp = new Date();

        const blob = tempBucket.file(fileName);
        const stream = blob.createWriteStream({
            metadata: {
                contentType: req.file.mimetype,
            },
        });

        stream.on('error', (error) => {
            console.error('Error uploading file:', error);
            return res.render('upload', { error: 'Failed to upload file' });
        });

        stream.on('finish', async () => {
            try {
                await db.collection('Upload-Status').add({
                    username: userName,
                    fileName: fileName,
                    time: timestamp,
                    status: 'Pending',
                });

                res.render('upload', { success: 'File uploaded successfully, wait for Admin confirmation!' });
            } catch (error) {
                console.error('Error saving to Firestore:', error);
                res.render('upload', { error: 'Failed to save upload status.' });
            }
        });

        stream.end(req.file.buffer);
    });
});

app.post('/trigger-copy', async (req, res) => {
    try {
        const response = await fetch(process.env.FUNCTION_COPY_URL, { method: 'POST' });
        const result = await response.text();
        res.send('Function Copy-Update Triggered Successfully!');
    } catch (error) {
        console.error('Error triggering Function Copy-Update:', error);
        res.status(500).send('Error Triggering Function Copy-Update');
    }
});

app.post('/trigger-delete', async (req, res) => {
    try {
        const response = await fetch(process.env.FUNCTION_DELETE_URL, { method: 'POST' });
        const result = await response.text();
        res.send('Function Delete Temporary Files Triggered Successfully!');
    } catch (error) {
        console.error('Error triggering Function Delete Temporary Files:', error);
        res.status(500).send('Error Triggering Function Delete Temporary Files');
    }
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
} else {
    console.log(`Test environment: Server will not start. Port: ${port}`);
}

module.exports = app;