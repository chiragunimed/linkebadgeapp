const express = require("express");
const session = require("express-session");
const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const overlayProfilePicture = require("./util/overlayImage");
const fs = require("fs");

dotenv.config();

const app = express();
app.use(express.static("public"));
app.use(express.json());
app.use(session({ secret: "badge_secret", resave: false, saveUninitialized: true }));

const CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// Start OAuth
app.get("/auth/linkedin", (req, res) => {
  const { email } = req.query;
  req.session.email = email;

  const scope = "r_liteprofile w_member_social";
  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${scope}&state=123456`;

  res.redirect(authUrl);
});

// Callback from LinkedIn
app.get("/auth/linkedin/callback", async (req, res) => {
  const { code } = req.query;
  const email = req.session.email || "guest@example.com";

  try {
    // Exchange code for token
    const tokenRes = await axios.post("https://www.linkedin.com/oauth/v2/accessToken", null, {
      params: {
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      },
       headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const accessToken = tokenRes.data.access_token;

    // Get profile
    const profileRes = await axios.get("https://api.linkedin.com/v2/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const picRes = await axios.get("https://api.linkedin.com/v2/me?projection=(profilePicture(displayImage~:playableStreams))", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const picElements = picRes.data.profilePicture["displayImage~"].elements;
    const profilePicUrl = picElements[picElements.length - 1].identifiers[0].identifier;

    // Overlay
    const outputPath = await overlayProfilePicture(profilePicUrl, email);

    // Upload to LinkedIn
    const uploadRes = await axios.post(
      "https://api.linkedin.com/v2/assets?action=registerUpload",
      {
        registerUploadRequest: {
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          owner: `urn:li:person:${profileRes.data.id}`,
          serviceRelationships: [
            { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
          ],
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const uploadUrl = uploadRes.data.value.uploadMechanism["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"].uploadUrl;
    const asset = uploadRes.data.value.asset;

    // Upload image binary
   const fs = require("fs");
const path = require("path");

// Read the generated image
const imageData = fs.readFileSync(outputPath);

// Upload image binary to LinkedIn
await axios.put(uploadUrl, imageData, {
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "image/png",
    "Content-Length": imageData.length,
  },
});


    // Post image to LinkedIn
   await axios.post(
  "https://api.linkedin.com/v2/ugcPosts",
  {
    author: `urn:li:person:${profileRes.data.id}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: "Excited to attend this event! #TiEQuest",
        },
        shareMediaCategory: "IMAGE",
        media: [
          {
            status: "READY",
            description: { text: "Event Badge" },
            media: asset,
            title: { text: "My Event Badge" },
          },
        ],
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  },
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  }
);


   res.send(`
  <h2>✅ Badge posted successfully!</h2>
  <p><a href="https://www.linkedin.com/in/${linkedinPublicId}" target="_blank">View your profile</a></p>
  <a href="/">Return</a>
`);

  } catch (err) {
    console.error(err.response?.data || err.message);
    res.send(`<h2>❌ Bummer! Something went wrong.</h2><a href="/">Try again</a>`);
  }
});

app.listen(3000, () => {
  console.log("✅ Server running on http://localhost:3000");
});
