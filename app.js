// server.js
require("dotenv").config();
const express = require("express");
const session = require("express-session");
const axios = require("axios");
const fetch = require("node-fetch");
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static("public"));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "badge_secret_key",
  resave: false,
  saveUninitialized: true,
}));

// Step 1: Start LinkedIn OAuth
app.get("/auth/linkedin", (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).send("Missing email");

  req.session.email = email;
  const scope = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

  //or use this >    const scope = ["openid", "profile", "email", "w_member_social"].join(" ");
  
  const redirectUri = encodeURIComponent(process.env.LINKEDIN_REDIRECT_URI);
  const clientId = process.env.LINKEDIN_CLIENT_ID;

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scope)}&state=secureState123`;
  res.redirect(authUrl);
});

// Step 2: LinkedIn callback
app.get("/auth/linkedin/callback", async (req, res) => {
  const code = req.query.code;
  try {
    const tokenRes = await axios.post("https://www.linkedin.com/oauth/v2/accessToken", null, {
      params: {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const accessToken = tokenRes.data.access_token;

    const userInfoRes = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profile = userInfoRes.data;
    const imageUrl = profile.picture || profile.picture_large;
    if (!imageUrl) throw new Error("Profile image not found");

    const userImageRes = await fetch(imageUrl);
    const userBuffer = await userImageRes.buffer();
    const badgeBuffer = fs.readFileSync(path.join(__dirname, process.env.BADGE_IMAGE_PATH));

    const compositeImagePath = `./public/output_${profile.sub}.png`;

    const resizedUserBuffer = await sharp(userBuffer)
       .resize(250, 250) // square and proportional
       .png()
      .toBuffer();
    const outputBuffer = await sharp(badgeBuffer)
      .composite([{ input: userBuffer, top: 900, left: 475 }])
      .png()
      .toBuffer();

    fs.writeFileSync(compositeImagePath, outputBuffer);

    const registerUploadRes = await axios.post(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${profile.sub}`,
          serviceRelationships: [{
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          }],
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const uploadUrl = registerUploadRes.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const asset = registerUploadRes.data.value.asset;

    await axios.put(uploadUrl, outputBuffer, {
      headers: { "Content-Type": "image/png" },
    });

//start of original code 
    // await axios.post(
    //   "https://api.linkedin.com/v2/ugcPosts",
    //   {
    //     author: `urn:li:person:${profile.sub}`,
    //     lifecycleState: "PUBLISHED",
    //     specificContent: {
    //       "com.linkedin.ugc.ShareContent": {
    //         shareCommentary: { text: "Excited to attend! Panorama India" },
    //         shareMediaCategory: "IMAGE",
    //         media: [{ status: "READY", media: asset }],
    //       },
    //     },
    //     visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    //   },
    //   { headers: { Authorization: `Bearer ${accessToken}` } }
    // );
//end of original code 
//disable the testing block and enable the original code press ctrl / for block unblock bulk 
    // 🔴 BEGIN TESTING POST ONLY — REMOVE THIS BLOCK FOR PRODUCTION USE
    await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      {
        author: `urn:li:person:${profile.sub}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: "Excited to be at Panorama Fest"
            },
            shareMediaCategory: "IMAGE",
            media: [
              {
                status: "READY",
                media: asset,
                title: {
                  text: "Test Badge"
                }
              }
            ]
          }
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "CONNECTIONS"
        }
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    // 🔴 END TESTING POST ONLY — REMOVE THIS BLOCK FOR PRODUCTION USE

    res.send(`<h2>✅ Badge posted to LinkedIn!</h2><img src="/output_${profile.sub}.png" width="300">`);
  }
  catch (err) {
  if (err.response) {
    console.error("OAuth/Posting error response data:", err.response.data);
  } else {
    console.error("OAuth/Posting error message:", err.message);
  //}
  //res.status(500).send("Something went wrong.");
}
});

app.listen(port, () => {
  console.log(`✅ Server running at http://localhost:${port}`);
});
