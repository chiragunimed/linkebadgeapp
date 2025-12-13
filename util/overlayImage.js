const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  try {
    if (!process.env.BADGE_IMAGE_PATH) {
      throw new Error("BADGE_IMAGE_PATH is not defined in .env");
    }

    const outputDir = path.join(__dirname, "../public");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputImagePath = path.join(outputDir, `output_${email}.png`);

    let badgeBuffer;
    const badgePath = process.env.BADGE_IMAGE_PATH;

    // ✅ ONLY treat as URL if it truly starts with http
    if (badgePath.startsWith("http://") || badgePath.startsWith("https://")) {
      const response = await axios.get(badgePath, { responseType: "arraybuffer" });
      badgeBuffer = Buffer.from(response.data);
    } else {
      const resolvedPath = path.resolve(__dirname, badgePath);
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Badge image file not found at path: ${resolvedPath}`);
      }
      badgeBuffer = fs.readFileSync(resolvedPath);
    }

    // Fetch profile image
    const profileResponse = await axios.get(profileUrl, { responseType: "arraybuffer" });
    const profileBuffer = Buffer.from(profileResponse.data);

    const profileResized = await sharp(profileBuffer)
      .resize(150, 150)
      .png()
      .toBuffer();

    await sharp(badgeBuffer)
      .composite([{ input: profileResized, top: 50, left: 50 }])
      .png()
      .toFile(outputImagePath);

    return outputImagePath;

  } catch (err) {
    console.error("❌ overlayProfilePicture failed:", err.message);
    throw err;
  }
}

module.exports = overlayProfilePicture;
