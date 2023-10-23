// Function to display the QR code
function displayQRCode() {
  const qrcodeImage = document.getElementById('qrcode');

  fetch('http://localhost:3000/qr')
    .then((response) => response.text())
    .then((data) => {
      console.log(data)
      qrcodeImage.src = data;
    })
    .catch((error) => {
      console.error('Error:', error);
    });
}

// Event listener for the "Show QR Code" button
document.getElementById('show-qrcode').addEventListener('click', () => {
  displayQRCode();
});
