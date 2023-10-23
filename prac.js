const express = require('express');
const app = express();
const { Client, MessageMedia, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const session = require('express-session');
const multer = require('multer'); // For handling file uploads
const csv = require('csv-parser'); // For parsing CSV files
const cors = require('cors');
app.use(cors())
const fs = require('fs');
const { promisify } = require('util');

app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

app.use(express.json());

// Create an array to store multiple WhatsApp client instances
const clients = {};

// Function to create or retrieve a client instance based on the user's session
function getClient(sessionId) {
  if (!clients[sessionId]) {
    // Create a new WhatsApp client for the user
    clients[sessionId] = new Client({
      authStrategy: new NoAuth(),
    //   puppeteer: {
    //     headless: false
    //   },
      session: {
        // Provide a path to store session data
        path: `./sessions/session_${sessionId}.json`,
        clientName: `User_${sessionId}`,
      },
    });

    // Initialize the WhatsApp client
    clients[sessionId].initialize();

    // Handle 'ready' and 'error' events for the client
    clients[sessionId].on('ready', () => {
      console.log(`Client ${sessionId} is ready`);
    });

    clients[sessionId].on('error', (error) => {
      console.error(`WhatsApp client ${sessionId} error:`, error);
    });
  }

  return clients[sessionId];
}

// Define a flag to track whether the QR code has been sent for each user
const qrSent = {};

// Handle user sessions and initialize WhatsApp clients
app.get('/user/:sessionId/qr', (req, res) => {
  const sessionId = req.params.sessionId;

  if (!qrSent[sessionId]) {
    const client = getClient(sessionId);

    client.on('qr', (qrCodeData) => {
      qrcode.toDataURL(qrCodeData, (err, dataUrl) => {
        if (!err) {
          qrSent[sessionId] = true; // Mark QR code as sent for this user
          res.send(`
            <html>
              <body>
                <img src="${dataUrl}" alt="QR Code" />
              </body>
            </html>
          `);
        } else {
          console.error(`Error generating QR code for user ${sessionId}:`, err);
        }
      });
    });
  } else {
    res.send('QR code not available yet.');
  }
});
// Create a storage engine for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

const Storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads'); // The directory where uploaded files will be saved
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Use the original file name
  },
});
const uploads = multer({ storage: Storage });
// Define a POST route for sending messages
app.post('/user/:sessionId/send-messages', upload.single('csv'), async (req, res) => {
  const sessionId = req.params.sessionId;
  const client = getClient(sessionId);

  // Rest of your code for sending messages goes here, similar to the original route

  try {
    // Read and process the CSV file containing contact numbers
    const contactNumbers = [];
    req.file.buffer
      .toString()
      .split('\n')
      .forEach((line) => {
        const number = line.trim();
        if (number) {
          contactNumbers.push(number);
        }
      });

    // Send messages to the contact numbers
    const message = req.body.message;

    const results = [];
    for (let index = 0; index < contactNumbers.length; index++) {
      let test = contactNumbers[index];
      let code = await client.sendMessage('234' + test + '@c.us', message);
      results.push({ contact: test, status: 'Message sent' });
    }

    res.status(200).json({ success: true, results });
  } catch (error) {
    console.error('Error sending messages:', error);
    res.status(500).json({ success: false, message: 'Error sending messages', error: error.message });
  }

});

// Define a POST route for sending media files (similar to the previous route)

app.post('user/:sessionId/send-media', uploads.fields([{ name: 'media', maxCount: 1 }, { name: 'csv', maxCount: 1 }]), async (req, res) => {
    const sessionId = req.params.sessionId;
    const client = getClient(sessionId);
    try {
      // Read and process the CSV file containing contact numbers
      const csvFile = await promisify(fs.readFile)(req.files['csv'][0].path);
      const mediaFile = req.files['media'][0];
  
      const numbers = csvFile.toString().split('\r\n').map((number) => number.trim());
  
      const results = [];
      for (const number of numbers) {
        // Validate the format of the phone number here (remove any special characters or spaces)
        const cleanNumber = number.replace(/[^\d]+/g, '');
  
        if (cleanNumber) {
          const media = MessageMedia.fromFilePath(mediaFile.path);
          const chat = await client.sendMessage('234' + cleanNumber + '@c.us', media);
          results.push({ contact: cleanNumber, status: 'Media sent' });
        }
      }
    } catch (error) {
      console.error('Error sending media:', error);
      res.status(500).json({ success: false, message: 'Error sending media', error: error.message });
    }
  });
  

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
