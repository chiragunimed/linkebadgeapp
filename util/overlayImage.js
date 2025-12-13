const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  try {
    console.log("▶ Badge image path:", process.env.BADGE_IMAGE_PATH);
    console.log("▶ Profile image URL:", profileUrl);

    if (!process.env.BADGE_IMAGE_PATH) {
      throw new Error("BADGE_IMAGE_PATH not set");
    }

    const outputDir = path.join(__dirname, "../public");
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    const outputImagePath = path.join(outputDir, `output_${email}.png`);
    const debugProfilePath = path.join(outputDir, `debug_profile_${email}.png`);

    /* ---------- LOAD BADGE ---------- */
    let badgeBuffer;
    const badgePath = process.env.BADGE_IMAGE_PATH;

    if (badgePath.startsWith("http")) {
      const badgeRes = await axios.get(badgePath, { responseType: "arraybuffer" });
      badgeBuffer = Buffer.from(badgeRes.data);
    } else {
      const resolved = path.resolve(__dirname, badgePath);
      if (!fs.existsSync(resolved)) {
        throw new Error(`Badge not found: ${resolved}`);
      }
      badgeBuffer = fs.readFileSync(resolved);
    }

    /* ---------- LOAD PROFILE IMAGE ---------- */
    const profileRes = await axios.get(profileUrl, {
      responseType: "arraybuffer",
      headers: {
        // CRITICAL for LinkedIn
        "User-Agent": "Mozilla/5.0",
        "Accept": "image/*"
      },
      maxRedirects: 5
    });

    const profileBuffer = Buffer.from(profileRes.data);

    // 🔴 SAVE PROFILE IMAGE FOR DEBUG
    fs.writeFileSync(debugProfilePath, profileBuffer);
    console.log("✔ Profile image saved at:", debugProfilePath);

    /* ---------- VALIDATE IMAGE ---------- */
    const meta = await sharp(profileBuffer).metadata();
    console.log("▶ Profile image metadata:", meta);

    if (!meta.width || meta.width < 50) {
      throw new Error("Invalid LinkedIn image (too small / blocked)");
    }

    /* ---------- RESIZE (UNCHANGED DIMENSIONS) ---------- */
    const profileResized = await sharp(profileBuffer)
      .resize(150, 150)
      .png()
      .toBuffer();

    /* ---------- COMPOSITE ---------- */
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

    console.log("✅ Badge created:", outputImagePath);
    return outputImagePath;

  } catch (err) {
    console.error("❌ overlayProfilePicture FAILED:", err.message);
    throw err;
  }
}

module.exports = overlayProfilePicture;
