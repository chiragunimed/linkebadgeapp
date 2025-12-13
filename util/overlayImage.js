const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  try {
    /* ------------------------------
       1. ENV VALIDATION
    ------------------------------ */
    if (!process.env.BADGE_IMAGE_PATH) {
      throw new Error("BADGE_IMAGE_PATH is not defined in .env");
    }

    if (!profileUrl) {
      throw new Error("Profile image URL is missing");
    }

    /* ------------------------------
       2. OUTPUT DIRECTORY
    ------------------------------ */
    const outputDir = path.join(__dirname, "../public");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const safeEmail = email.replace(/[^a-zA-Z0-9]/g, "_");
    const outputImagePath = path.join(
      outputDir,
      `output_${safeEmail}.png`
    );

    /* ------------------------------
       3. LOAD BADGE IMAGE
    ------------------------------ */
    const badgePath = process.env.BADGE_IMAGE_PATH;
    let badgeBuffer;

    if (badgePath.startsWith("http://") || badgePath.startsWith("https://")) {
      console.log("📥 Fetching badge from URL:", badgePath);

      const badgeResponse = await axios.get(badgePath, {
        responseType: "arraybuffer",
        timeout: 10000
      });

      badgeBuffer = Buffer.from(badgeResponse.data);
    } else {
      const resolvedBadgePath = path.resolve(__dirname, badgePath);

      if (!fs.existsSync(resolvedBadgePath)) {
        throw new Error(`Badge image not found at: ${resolvedBadgePath}`);
      }

      console.log("📁 Using local badge:", resolvedBadgePath);
      badgeBuffer = fs.readFileSync(resolvedBadgePath);
    }

    /* ------------------------------
       4. FETCH PROFILE IMAGE
    ------------------------------ */
    console.log("📥 Fetching LinkedIn profile image");

    const profileResponse = await axios.get(profileUrl, {
      responseType: "arraybuffer",
      timeout: 10000,
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!profileResponse.data || profileResponse.data.length < 1000) {
      throw new Error("Profile image download failed or returned empty data");
    }

    const profileBuffer = Buffer.from(profileResponse.data);

    /* ------------------------------
       5. RESIZE PROFILE (UNCHANGED)
    ------------------------------ */
    const profileResized = await sharp(profileBuffer)
      .resize(150, 150)                 // ❗ unchanged
      .ensureAlpha()                    // ✅ CRITICAL FIX
      .png()
      .toBuffer();

    /* ------------------------------
       6. COMPOSITE (UNCHANGED)
    ------------------------------ */
    await sharp(badgeBuffer)
      .ensureAlpha()
      .composite([
        {
          input: profileResized,
          top: 50,                      // ❗ unchanged
          left: 50,                     // ❗ unchanged
          blend: "over"
        }
      ])
      .png()
      .toFile(outputImagePath);

    console.log("✅ Badge generated:", outputImagePath);
    return outputImagePath;

  } catch (err) {
    console.error("❌ overlayProfilePicture failed");
    console.error(err.message);
    throw err;
  }
}

module.exports = overlayProfilePicture;
