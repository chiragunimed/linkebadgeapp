const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  const badgeUrl = process.env.BADGE_IMAGE_PATH; // must be full public URL
  const outputImagePath = path.join(__dirname, `../public/output_${email}.png`);

  let baseBuffer;

  if (badgeUrl.startsWith("http")) {
    // fetch the badge from public URL
    const badgeResponse = await axios.get(badgeUrl, { responseType: "arraybuffer" });
    baseBuffer = Buffer.from(badgeResponse.data);
  } else {
    // fallback to local file (for dev)
    const localPath = path.join(__dirname, "../public/base_badge.png");
    baseBuffer = fs.readFileSync(localPath);
  }

  // fetch profile picture
  const profileResponse = await axios.get(profileUrl, { responseType: "arraybuffer" });
  const profileBuffer = Buffer.from(profileResponse.data);

  // resize and circle crop profile picture
  const profileResized = await sharp(profileBuffer)
    .resize(150, 150)
    .circle()
    .png()
    .toBuffer();

  // composite profile onto badge
  await sharp(baseBuffer)
    .composite([{ input: profileResized, top: 50, left: 50 }])
    .png()
    .toFile(outputImagePath);

  return outputImagePath;
}

module.exports = overlayProfilePicture;
