const sharp = require("sharp");
const path = require("path");
const axios = require("axios");
const fs = require("fs");

/**
 * Overlay a LinkedIn profile picture onto the base badge.
 * @param {string} profileUrl - URL of the LinkedIn profile picture
 * @param {string} email - Email used to generate the output badge filename
 * @returns {string} - Full path of the generated badge
 */
async function overlayProfilePicture(profileUrl, email) {
  try {
    // Path to the base badge template inside MYEVENT folder
    const baseImagePath = path.join(__dirname, "../MYEVENT/badge.png");

    // Path to store the final badge output
    const outputImagePath = path.join(__dirname, "../MYEVENT/public/output_" + email + ".png");

    // Ensure the output directory exists
    const outputDir = path.dirname(outputImagePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Download the LinkedIn profile picture
    const response = await axios.get(profileUrl, { responseType: "arraybuffer" });
    const profileBuffer = Buffer.from(response.data);

    // Resize and make the profile picture circular
    const profileResized = await sharp(profileBuffer)
      .resize(150, 150) // adjust size as needed
      .png()
      .toBuffer();

    // Overlay the profile picture onto the base badge
    await sharp(baseImagePath)
      .composite([{ input: profileResized, top: 50, left: 50 }]) // adjust coordinates as needed
      .png()
      .toFile(outputImagePath);

    console.log("Badge successfully created at:", outputImagePath);
    return outputImagePath;

  } catch (error) {
    console.error("Error generating badge:", error);
    throw error;
  }
}

module.exports = overlayProfilePicture;
