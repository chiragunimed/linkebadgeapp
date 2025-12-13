const sharp = require("sharp");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  const baseImagePath = path.join(__dirname, "../base_badge.png");
  const outputImagePath = path.join(__dirname, `../public/output_${email}.png`);

  const response = await axios.get(profileUrl, { responseType: "arraybuffer" });
  const profileBuffer = Buffer.from(response.data);

  const profileResized = await sharp(profileBuffer)
    .resize(150, 150)
    .circle()
    .png()
    .toBuffer();

  await sharp(baseImagePath)
    .composite([{ input: profileResized, top: 50, left: 50 }]) // adjust coordinates
    .png()
    .toFile(outputImagePath);

  return outputImagePath;
}

module.exports = overlayProfilePicture;
