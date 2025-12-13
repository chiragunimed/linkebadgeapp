const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

/**
 * Overlay a LinkedIn profile picture onto a badge.
 * Handles both local and public URL badge templates.
 * @param {string} profileUrl - LinkedIn profile image URL
 * @param {string} email - User email, used to generate output filename
 * @returns {string} - Path to generated badge
 */
async function overlayProfilePicture(profileUrl, email) {
  try {
    // Output folder setup
    const outputDir = path.join(__dirname, "../public");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    // Determine badge template path
    const badgeUrl = process.env.BADGE_IMAGE_PATH; // can be local path or URL
    let baseBuffer;

    if (!badgeUrl) throw new Error("BADGE_IMAGE_PATH environment variable is not set.");

    if (badgeUrl.startsWith("http")) {
      console.log("Fetching badge from URL:", badgeUrl);
      const badgeResponse = await axios.get(badgeUrl, { responseType: "arraybuffer" });
      baseBuffer = Buffer.from(badgeResponse.data);
    } else {
      const localPath = path.isAbsolute(badgeUrl)
        ? badgeUrl
        : path.join(__dirname, badgeUrl);

      if (!fs.existsSync(localPath)) {
        throw new Error(`Badge image file not found at path: ${localPath}`);
      }
      console.log("Using local badge at path:", localPath);
      baseBuffer = fs.readFileSync(localPath);
    }

    // Fetch profile picture
    if (!profileUrl) throw new Error("Profile URL is not provided.");
    console.log("Fetching profile image from:", profileUrl);
    const profileResponse = await axios.get(profileUrl, { responseType: "arraybuffer" });
    const profileBuffer = Buffer.from(profileResponse.data);

    // Resize and circle crop
    const profileResized = await sharp(profileBuffer)
      .resize(150, 150)
      .png()
      .toBuffer();

    // Composite profile onto badge
    const outputImagePath = path.join(outputDir, `output_${email}.png`);
    await sharp(baseBuffer)
      .composite([{ input: profileResized, top: 50, left: 50 }]) // adjust top/left as needed
      .png()
      .toFile(outputImagePath);

    console.log("Badge created successfully at:", outputImagePath);
    return outputImagePath;
  } catch (err) {
    console.error("Error in overlayProfilePicture:", err.message || err);
    throw err;
  }
}

module.exports = overlayProfilePicture;
