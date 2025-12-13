const sharp = require("sharp");
const axios = require("axios");
const path = require("path");
const fs = require("fs");

async function overlayProfilePicture(profileUrl, email) {
  try {
    console.log("▶ Starting overlay process");

    if (!process.env.BADGE_IMAGE_PATH) {
      throw new Error("BADGE_IMAGE_PATH is not defined");
    }

    if (!profileUrl) {
      throw new Error("Profile URL is empty");
    }

    const outputDir = path.join(__dirname, "../public");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputImagePath = path.join(outputDir, `output_${email}.png`);
    const debugProfilePath = path.join(outputDir, `debug_profile_${email}.png`);

    // -------------------------
    // 1️⃣ LOAD BADGE IMAGE
    // -------------------------
    let badgeBuffer;
    const badgePath = process.env.BADGE_IMAGE_PATH;

    if (badgePath.startsWith("http://") || badgePath.startsWith("https://")) {
      console.log("▶ Fetching badge from URL");
      const res = await axios.get(badgePath, { responseType: "arraybuffer" });
      badgeBuffer = Buffer.from(res.data);
    } else {
      const resolvedBadgePath = path.resolve(__dirname, badgePath);
      if (!fs.existsSync(resolvedBadgePath)) {
        throw new Error(`Badge not found: ${resolvedBadgePath}`);
      }
      badgeBuffer = fs.readFileSync(resolvedBadgePath);
    }

    console.log("✔ Badge loaded");

    // -------------------------
    // 2️⃣ FETCH PROFILE IMAGE
    // -------------------------
    console.log("▶ Fetching profile image");
    const profileRes = await axios.get(profileUrl, {
      responseType: "arraybuffer",
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    const profileBuffer = Buffer.from(profileRes.data);

    // 🔥 CRITICAL CHECK
    if (profileBuffer.length < 5000) {
      throw new Error("Profile image is too small — LinkedIn returned placeholder or blocked image");
    }

    // Save raw profile image for inspection
    fs.writeFileSync(debugProfilePath, profileBuffer);
    console.log("✔ Profile image saved for debug:", debugProfilePath);

    // -------------------------
    // 3️⃣ RESIZE (UNCHANGED)
    // -------------------------
    const profileResized = await sharp(profileBuffer)
      .resize(150, 150) // ⛔ unchanged
      .png()
      .toBuffer();

    console.log("✔ Profile image resized");

    // -------------------------
    // 4️⃣ COMPOSITE
    // -------------------------
    await sharp(badgeBuffer)
      .composite([
        {
          input: profileResized,
          top: 50,   // ⛔ unchanged
          left: 50   // ⛔ unchanged
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
