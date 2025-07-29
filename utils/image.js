const sharp = require('sharp');
const path = require('path');
const axios = require('axios');
const fs = require('fs');

async function createCompositedImage(linkedinProfilePicUrl) {
  try {
    // Step 1: Load the local base image from /public
    const baseImagePath = path.join(__dirname, '..', 'public', 'te.png');
    const baseImageBuffer = fs.readFileSync(baseImagePath);

    // Step 2: Download guest's LinkedIn profile image
    const response = await axios.get(linkedinProfilePicUrl, { responseType: 'arraybuffer' });
    const guestImageBuffer = Buffer.from(response.data, 'binary');

    // Step 3: Resize and optionally make guest image circular
    const guestImage = await sharp(guestImageBuffer)
      .resize(180, 180)
      .composite([{
        input: Buffer.from(
          `<svg><circle cx="90" cy="90" r="90" /></svg>`
        ),
        blend: 'dest-in'
      }])
      .png()
      .toBuffer();

    // Step 4: Composite the two
    const finalImageBuffer = await sharp(baseImageBuffer)
      .composite([
        {
          input: guestImage,
          top: 900,     // adjust based on image height
          left: 900     // adjust based on image width
        }
      ])
      .toBuffer();

    return finalImageBuffer;
  } catch (err) {
    console.error('Error creating final image:', err);
    throw err;
  }
}

module.exports = { createCompositedImage };
