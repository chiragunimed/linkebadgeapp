const sharp = require("sharp");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  const badgeUrl = process.env.BADGE_IMAGE_PATH; // public URL
  const outputImagePath = path.join(__dirname, `../public/output_${email}.png`);

  let baseBuffer;

  // If badgeUrl starts with http, fetch it
  if (badgeUrl.startsWith("http")) {
    const badgeResponse = await axios.get(badgeUrl, { responseType: "arraybuffer" });
    baseBuffer = Buffer.from(badgeResponse.data);
  } else {
    // fallback for local development
    const localPath = path.join(__dirname, "../public/base_badge.png");
    baseBuffer = fs.readFileSync(localPath);
  }

  // Fetch profile picture
  const profileResponse = await axios.get(profileUrl, { responseType: "arraybuffer" });
  const profileBuffer = Buffer.from(profileResponse.data);

  // Resize and circle crop profile
  const profileResized = await sharp(profileBuffer)
    .resize(150, 150)
    .circle()
    .png()
    .toBuffer();

  // Composite profile onto badge
  await sharp(baseBuffer)
    .composite([{ input: profileResized, top: 50, left: 50 }]) // adjust coordinates
    .png()
    .toFile(outputImagePath);

  return outputImagePath; // local path to generated badge
}

module.exports = overlayProfilePicture;
