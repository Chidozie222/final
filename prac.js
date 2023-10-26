const express = require('express');
const app = express();
app.use(express.json())
const { Client, MessageMedia, NoAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const session = require('express-session');
const multer = require('multer'); // For handling file uploads
const csv = require('csv-parser'); // For parsing CSV files
const cors = require('cors');
app.use(cors())
const fs = require('fs');
const { promisify, log } = require('util');
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
let mongoUrl = "mongodb+srv://john:fugZrMMyLCnb8In9@cluster0.cyzwmu6.mongodb.net/?retryWrites=true&w=majority";

mongoose
  .connect(mongoUrl, {
    useNewUrlParser: true,
  })
  .then(() => {
    console.log("Connected to database");
  })
  .catch((e) => console.log(e));
require("./mongodb")

const user = mongoose.model("whatsapp")
const JWT_SECRET =
  "hvdvay6ert72839289()aiyg8t87qt72393293883uhefiuh78ttq3ifi78272jbkj?[]]pou89ywe";

app.post("/register", async(req, res) => {
  const {Username, email, password} = req.body;
  const secret = await bcrypt.hash(password, 10)

  try {
    const olduser = await user.findOne({email: email})
    if(olduser){
      return res.send({error: "User exists, Please sign in"})
    } else{
        await user.create({
          Username,
          email,
          password: secret
        })
        res.send({status: "ok"}) 
    }
  } catch (error) {
    res.send({error: error})
  }
})

app.post('/signin', async (req, res) => {
  const { email, password } = req.body;
  try {
    const User = await user.findOne({ email: email }); // Use 'User' to access the user model
    if (!user) {
      return res.status(400).json({ error: 'Please sign up' });
    } else {
      const passwordMatch = await bcrypt.compare(password, User.password); // Assuming user.password exists in your database
      if (passwordMatch) {
        return res.status(201).json({ status: 'ok'});
      } else {
        return res.status(401).json({ error: 'Invalid password' });
      }
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post ("/userData", async (req, res) => {
  const { email } = req.body;
  try {
    const file = await user.findOne({email: email})
    res.send({status: "ok", data: file})
  } catch (error) { 
    res.send({error: "there is an error in the server"})
  }
});



app.use(express.json());
const clients = {};
// Function to get or create a WhatsApp client for a specific session
function getClient(sessionId, readyCallback) {
  if (!clients[sessionId]) {
    // Create a new WhatsApp client for the user
    clients[sessionId] = new Client({
      authStrategy: new NoAuth(),
      session: {
        path: `./sessions/session_${sessionId}.json`,
        clientName: `User_${sessionId}`,
      },
    });

    // Initialize the WhatsApp client
    clients[sessionId].initialize();

    // Handle 'ready' and 'error' events for the client
    clients[sessionId].on('ready', () => {
      const readyMessage = `Client ${sessionId} is ready`;

      if (typeof readyCallback === 'function') {
        readyCallback(readyMessage);
      }

      console.log(readyMessage);
    });

    clients[sessionId].on('error', (error) => {
      console.error(`WhatsApp client ${sessionId} error:`, error);
    });
  }

  return clients[sessionId];
}

const qrData = {}; // Store QR code data for each session

// Handle the route for serving the QR code
app.get('/user/:sessionId/qr', (req, res) => {
  const sessionId = req.params.sessionId;

  if (!qrData[sessionId]) {
    qrData[sessionId] = {
      data: null,
      sent: false,
    };
  }

  const client = getClient(sessionId);

  client.on('qr', (qrCodeData) => {
    // Only send the new QR code if it has changed
    if (qrData[sessionId].data !== qrCodeData) {
      qrData[sessionId].data = qrCodeData;
      qrData[sessionId].sent = false; // Mark as not sent

      qrcode.toDataURL(qrCodeData, (err, dataUrl) => {
        if (!err) {
          // Check if it hasn't been sent in the meantime
          if (!qrData[sessionId].sent) {
            qrData[sessionId].sent = true; // Mark as sent
            res.send(`
              <html>
                <body>
                  <img src="${dataUrl}" alt="QR Code" />
                </body>
              </html>
            `);
            return 
          }
        } else {
          console.error(`Error generating QR code for user ${sessionId}:`, err);
        }
      });
    } else {
      res.send('QR code not available yet.');
    }
  });
});


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
