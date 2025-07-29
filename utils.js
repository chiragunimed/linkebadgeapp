// utils.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function generateBadge(profileImageBuffer, userName, outputFilePath) {
  const baseImagePath = path.join(__dirname, process.env.BASE_IMAGE_PATH || 'public/base_badge.png');

  try {
    const resizedProfilePic = await sharp(profileImageBuffer)
      .resize(120, 120)
      .composite([
        {
          input: Buffer.from(
            `<svg><circle cx="60" cy="60" r="60" fill="white"/></svg>`
          ),
          blend: 'dest-in',
        },
      ])
      .png()
      .toBuffer();

    await sharp(baseImagePath)
      .composite([
        {
          input: resizedProfilePic,
          top: 260,
          left: 260, // change as per your badge design
        },
      ])
      .toFile(outputFilePath);

    console.log('✅ Badge generated at', outputFilePath);
  } catch (error) {
    console.error('❌ Error generating badge:', error);
    throw error;
  }
}

module.exports = { generateBadge };
