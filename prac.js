const express = require('express');
const app = express();
const qrcode = require('qrcode');
const { Client } = require('whatsapp-web.js');

let qrData = null; // Initialize a variable to store the QR code data
let isClientReady = false; // Initialize a variable to track if the client is ready

// Initialize a WhatsApp client
const client = new Client({});

client.on('ready', () => {
  console.log('WhatsApp client is ready');
  isClientReady = true; // Set the flag to indicate that the client is ready
});

client.on('qr', (qrCodeData) => {
  qrcode.toDataURL(qrCodeData, (err, dataUrl) => {
    if (!err) {
      qrData = dataUrl; // Store the QR code data in the variable
    } else {
      console.error('Error generating QR code:', err);
    }
  });
});

// Initialize the WhatsApp client
client.initialize();

app.get('/qr', (req, res) => {
  if (qrData) {
    res.send(`
      <html>
        <body>
          <img src="${qrData}" alt="QR Code" />
        </body>
      </html>
    `);
  } else {
    res.send('QR code not available yet.');
  }
});

app.get('/status', (req, res) => {
  if (isClientReady) {
    res.send('WhatsApp client is ready and connected.');
  } else {
    res.send('WhatsApp client is not ready yet.');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});
