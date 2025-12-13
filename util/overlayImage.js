const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

/**
 * Overlay a LinkedIn profile picture onto a badge.
 * Fully debugged and logs all paths and metadata.
 * @param {string} profileUrl - LinkedIn profile image URL
 * @param {string} email - Used for output filename
 * @returns {string} - Path to generated badge
 */
async function overlayProfilePicture(profileUrl, email) {
  try {
    console.log("▶ BADGE_IMAGE_PATH env:", process.env.BADGE_IMAGE_PATH);
    console.log("▶ Profile image URL:", profileUrl);

    if (!process.env.BADGE_IMAGE_PATH) {
      throw new Error("BADGE_IMAGE_PATH not set in .env");
    }

    // ------------------ OUTPUT DIRECTORY ------------------
    const outputDir = path.join(__dirname, "../public");
    if (!fs.existsSync(outputDir)) {
      console.log("📂 Creating output directory:", outputDir);
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputImagePath = path.join(outputDir, `output_${email}.png`);
    const debugProfilePath = path.join(outputDir, `debug_profile_${email}.png`);

    // ------------------ LOAD BADGE ------------------
    let badgeBuffer;
    const badgePath = process.env.BADGE_IMAGE_PATH;

    if (badgePath.startsWith("http://") || badgePath.startsWith("https://")) {
      console.log("🌐 Fetching badge from URL:", badgePath);
      const badgeRes = await axios.get(badgePath, { responseType: "arraybuffer" });
      badgeBuffer = Buffer.from(badgeRes.data);
    } else {
      const resolved = path.resolve(__dirname, badgePath);
      console.log("📂 Using local badge path:", resolved);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Badge image not found at path: ${resolved}`);
      }
      badgeBuffer = fs.readFileSync(resolved);
    }

    // ------------------ FETCH PROFILE IMAGE ------------------
    console.log("🌐 Fetching LinkedIn profile image...");
    const profileRes = await axios.get(profileUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/*"
      },
      maxRedirects: 5
    });

    const profileBuffer = Buffer.from(profileRes.data);

    // 🔴 Save profile image for debugging
    fs.writeFileSync(debugProfilePath, profileBuffer);
    console.log("✔ Profile image saved for debug at:", debugProfilePath);

    // ------------------ VALIDATE PROFILE IMAGE ------------------
    const meta = await sharp(profileBuffer).metadata();
    console.log("▶ Profile image metadata:", meta);
    if (!meta.width || meta.width < 50) {
      throw new Error("Invalid LinkedIn image (too small or blocked)");
    }

    // ------------------ RESIZE PROFILE IMAGE (unchanged) ------------------
    const profileResized = await sharp(profileBuffer)
      .resize(150, 150) // unchanged dimensions
      .png()
      .toBuffer();

    // ------------------ COMPOSITE ------------------
    console.log("🎨 Overlaying profile onto badge...");
    await sharp(badgeBuffer)
      .composite([
        {
          input: profileResized,
          top: 50,
          left: 50,
          blend: "over"
        }
      ])
      .png()
      .toFile(outputImagePath);

    console.log("✅ Badge successfully created at:", outputImagePath);
    return outputImagePath;

  } catch (err) {
    console.error("❌ overlayProfilePicture FAILED:", err.message);
    throw err;
  }
}

module.exports = overlayProfilePicture;
