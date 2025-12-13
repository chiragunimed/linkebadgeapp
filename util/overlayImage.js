const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  try {
    if (!process.env.BADGE_IMAGE_PATH) {
      throw new Error("BADGE_IMAGE_PATH is not defined in .env");
    }

    if (!profileUrl) {
      throw new Error("Profile URL is missing");
    }

    /* -----------------------------
       OUTPUT SETUP
    ------------------------------ */
    const outputDir = path.join(__dirname, "../public");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputImagePath = path.join(
      outputDir,
      `output_${email.replace(/[^a-zA-Z0-9]/g, "_")}.png`
    );

    /* -----------------------------
       LOAD BADGE IMAGE
    ------------------------------ */
    let badgeBuffer;
    const badgePath = process.env.BADGE_IMAGE_PATH.trim();

    if (badgePath.startsWith("http://") || badgePath.startsWith("https://")) {
      console.log("⬇️ Downloading badge from URL");
      const badgeResponse = await axios.get(badgePath, {
        responseType: "arraybuffer",
      });
      badgeBuffer = Buffer.from(badgeResponse.data);
    } else {
      const resolvedBadgePath = path.resolve(__dirname, badgePath);
      console.log("📂 Using local badge:", resolvedBadgePath);

      if (!fs.existsSync(resolvedBadgePath)) {
        throw new Error(`Badge image not found: ${resolvedBadgePath}`);
      }

      badgeBuffer = fs.readFileSync(resolvedBadgePath);
    }

    /* -----------------------------
       DOWNLOAD LINKEDIN IMAGE
       (THIS IS WHERE IT WAS FAILING)
    ------------------------------ */
    console.log("⬇️ Downloading LinkedIn profile image");

    const profileResponse = await axios.get(profileUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0", // 🔑 REQUIRED for LinkedIn
      },
    });

    const profileBuffer = Buffer.from(profileResponse.data);

    // 🔍 HARD VALIDATION
    if (profileBuffer.length < 5000) {
      throw new Error("Profile image download failed or returned invalid data");
    }

    // Optional debug (remove later)
    fs.writeFileSync(
      path.join(outputDir, "debug_profile_download.png"),
      profileBuffer
    );

    /* -----------------------------
       RESIZE PROFILE (DO NOT CHANGE SIZE)
    ------------------------------ */
    const profileResized = await sharp(profileBuffer)
      .resize(150, 150) // ❗ unchanged
      .ensureAlpha()    // 🔑 REQUIRED
      .png()
      .toBuffer();

    /* -----------------------------
       COMPOSITE
    ------------------------------ */
    await sharp(badgeBuffer)
      .ensureAlpha() // 🔑 REQUIRED
      .composite([
        {
          input: profileResized,
          top: 50,   // ❗ unchanged
          left: 50,  // ❗ unchanged
        },
      ])
      .png()
      .toFile(outputImagePath);

    console.log("✅ Badge generated:", outputImagePath);
    return outputImagePath;

  } catch (err) {
    console.error("❌ overlayProfilePicture FAILED");
    console.error(err.message);
    throw err;
  }
}

module.exports = overlayProfilePicture;
