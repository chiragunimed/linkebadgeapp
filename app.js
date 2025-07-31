const express = require("express");
const session = require("express-session");
const axios = require("axios");
const dotenv = require("dotenv");
const sharp = require("sharp");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(session({
  secret: "badge_secret_key",
  resave: false,
  saveUninitialized: true,
}));

app.use(express.static("public"));
app.use(express.json());

// Step 1: Start LinkedIn OAuth from Mailchimp email (e.g. /auth/linkedin?email=abc@example.com)
app.get("/auth/linkedin", (req, res) => {
  const { email } = req.query;
  req.session.email = email;

  const scope = ["openid", "profile", "email", "w_member_social"].join(" ");
  const redirectUri = encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI);
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scope)}&state=secureState123`;

  res.redirect(authUrl);
});

// Step 2: LinkedIn Callback
app.get("/auth/linkedin/callback", async (req, res) => {
  const code = req.query.code;
  try {
    const tokenRes = await axios.post("https://www.linkedin.com/oauth/v2/accessToken", null, {
      params: {
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const accessToken = tokenRes.data.access_token;

    // Step 3: Get profile info
    const userInfoRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profile = userInfoRes.data;
    const name = profile.name || profile.given_name || "Guest";

    const imageUrl = profile.picture?.[0]?.data?.url || profile.picture || null;
    if (!imageUrl) throw new Error("Profile image not found");

    // Step 4: Download image & overlay
    const userImageRes = await fetch(imageUrl);
    const userBuffer = await userImageRes.buffer();

    const badgeBuffer = fs.readFileSync(process.env.BADGE_IMAGE_PATH);
    const compositeImagePath = `./output/${profile.sub}_badge.png`;
    const outputBuffer = await sharp(badgeBuffer)
      .composite([
        { input: userBuffer, top: 50, left: 50, blend: "over" }
      ])
      .resize(800)
      .png()
      .toBuffer();

    fs.writeFileSync(compositeImagePath, outputBuffer);

    // Step 5: Upload to LinkedIn
    const registerUploadRes = await axios.post(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${profile.sub}`,
          serviceRelationships: [{ relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" }],
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const uploadUrl = registerUploadRes.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const asset = registerUploadRes.data.value.asset;

    await axios.put(uploadUrl, outputBuffer, {
      headers: { "Content-Type": "image/png" },
    });

    // Step 6: Post to feed
    await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      {
        author: `urn:li:person:${profile.sub}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: `Excited to attend! #TiE #Networking`,
            },
            shareMediaCategory: "IMAGE",
            media: [{ status: "READY", description: { text: "Badge" }, media: asset, title: { text: "My Badge" } }],
          },
        },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    res.send(`<h2>✅ Badge posted to LinkedIn, ${name}!</h2>`);

  } catch (err) {
    console.error("OAuth/Posting error:", err.response?.data || err.message);
    res.status(500).send("Something went wrong.");
  }
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
