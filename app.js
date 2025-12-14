// server.js
require("dotenv").config();
console.log("\ud83d\udd27 BADGE_IMAGE_PATH from env:", process.env.BADGE_IMAGE_PATH);
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
        code,
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

    // this code from line 62 till line 90 is replaced with another code 
    //functionality change is that if image is not found then write the firstname in bordered box  94 to 144 
    // const profile = userInfoRes.data;
    // const imageUrl = profile.picture || profile.picture_large;
    // if (!imageUrl) throw new Error("Profile image not found");

    // const userImageRes = await fetch(imageUrl);
    // const userBuffer = await userImageRes.buffer();
    // const profileSize = 250 
    // // Added badge image path validation and debug logs
    
    // const badgeImagePath = process.env.BADGE_IMAGE_PATH;
    // console.log("Badge image path:", badgeImagePath);
    // if (!badgeImagePath) {
    //   throw new Error("BADGE_IMAGE_PATH environment variable is not defined");
    // }
    // const fullBadgeImagePath = path.join(__dirname, badgeImagePath);
    // if (!fs.existsSync(fullBadgeImagePath)) {
    //   throw new Error(`Badge image file not found at path: ${fullBadgeImagePath}`);
    // }

    // const badgeBuffer = fs.readFileSync(fullBadgeImagePath);

    // const compositeImagePath = `./public/output_${profile.sub}.png`;

    // const resizedUserBuffer = await sharp(userBuffer)
    //   .resize(250, 250) // square and proportional
    //   .png()
    //   .toBuffer();

    // remove this code and use 62 to 90 if only image is required zzzz from 94 to 144
    const profile = userInfoRes.data;
    const imageUrl = profile.picture || profile.picture_large;
    const profileSize = 250;

    let resizedUserBuffer;

    if (imageUrl) {
      try {
        const userImageRes = await fetch(imageUrl);
        const userBuffer = await userImageRes.buffer();

        const imageWithoutBorder = await sharp(userBuffer)
          .resize(profileSize, profileSize, { fit: 'cover' })
          .png()
          .toBuffer();

        // Add green border SVG
        const borderWidth = 6;
        const borderSvg = `
          <svg width="${profileSize}" height="${profileSize}">
            <rect x="0" y="0" width="${profileSize}" height="${profileSize}" 
              fill="none" stroke="rgb(19, 136, 8)" stroke-width="${borderWidth}" />
          </svg>
        `;

        resizedUserBuffer = await sharp(imageWithoutBorder)
          .composite([{ input: Buffer.from(borderSvg), blend: 'over' }])
          .png()
          .toBuffer();

      } catch (err) {
        console.warn("Failed to load image, fallback to name box:", err);
      }
    }

    if (!resizedUserBuffer) {
      // const nameText = `${profile.localizedFirstName || ''} ${profile.localizedLastName || ''}`.trim() || "Guest"; // this is first lastname if not found return Guest
      const nameText = (profile.localizedFirstName || '').trim() || "Guest";
      const nameSvg = `
        <svg width="${profileSize}" height="${profileSize}">
          <style>
            .text { fill: rgb(19,136,8); font-size: 30px; font-family: Arial, sans-serif; font-weight: bold; dominant-baseline: middle; text-anchor: middle; }
          </style>
          <rect x="0" y="0" width="${profileSize}" height="${profileSize}" fill="white" stroke="rgb(19,136,8)" stroke-width="6" />
          <text x="50%" y="50%" class="text">${nameText}</text>
        </svg>
      `;

      resizedUserBuffer = await sharp(Buffer.from(nameSvg))
        .png()
        .toBuffer();
    }

    // end of new code zzzz 
    //formating the image border color etc 
    const borderWidth = 6; // border thickness
    const borderSvg = `
      <svg width="${profileSize}" height="${profileSize}">
        <rect x="0" y="0" width="${profileSize}" height="${profileSize}" 
          fill="none" stroke="rgb(19, 136, 8)" stroke-width="${borderWidth}" />
      </svg>
    `;

    const profileWithBorder = await sharp(resizedUserBuffer)
      .composite([
        {
          input: Buffer.from(borderSvg),
          blend: 'over'
        }
      ])
      .png()
      .toBuffer();

    //end of formating 
    const badgeImagePath = process.env.BADGE_IMAGE_PATH;
    console.log("Badge image path:", badgeImagePath);
    if (!badgeImagePath) {
      throw new Error("BADGE_IMAGE_PATH environment variable is not defined");
    }
    const fullBadgeImagePath = path.join(__dirname, badgeImagePath);
    if (!fs.existsSync(fullBadgeImagePath)) {
      throw new Error(`Badge image file not found at path: ${fullBadgeImagePath}`);
    }

    const badgeBuffer = fs.readFileSync(fullBadgeImagePath);
    const compositeImagePath = `./public/output_${profile.sub}.png`;

    const outputBuffer = await sharp(badgeBuffer)
      .composite([{ input: profileWithBorder, top: 820, left: 150 }]) // input: resizedUserBuffer changed to profileWithBorder this variable has the new color overlay on profile pic
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
    //         shareCommentary: { text: "Attending Panorama India is a reminder of how culture can unite and inspire. Kudos to the Directors and entire team for their relentless commitment to fostering understanding, celebrating heritage, and strengthening Indo-Canadian ties. A cultural masterpiece! \ud83d\ude4c\ud83c\udf1f #CelebrateCulture #PanoramaIndia" 
    //         }, 
    //          shareMediaCategory: "IMAGE",
    //         media: [{ status: "READY", media: asset }],
    //       },
    //     },
    //     visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    //   },
    //   { headers: { Authorization: `Bearer ${accessToken}` } }
    // );
    //end of original code 
    //disable the testing block and enable the original code press ctrl / for block unblock bulk 
    // \ud83d\udd34 BEGIN TESTING POST ONLY — REMOVE THIS BLOCK FOR PRODUCTION USE
    await axios.post(
      "https://api.linkedin.com/v2/ugcPosts",
      {
        author: `urn:li:person:${profile.sub}`,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: {
              text: "Happy to be attending the Immigration Professionals Gala 2025 hosted by #CIPEDA on December 18 at Embassy Grand.  Looking forward to connecting with fellow immigration professionals and celebrating our community. #ImmigrationGala2025 #RCIC"
              //"Attending INDIA DAY with Panorama is a reminder of how culture can unite and inspire. Kudos to the Organising Committee and entire team for their relentless commitment to fostering understanding, celebrating heritage, and strengthening Indo-Canadian bond. A cultural masterpiece!  #CelebrateCulture #PanoramaINDIA2025"
              // or paste here from mailchimp as you want it , upload. this file on server onrender ,redeploy zzzz right now PANORAMA Is ON
              //text :" "
             // text: "Attending Brampton Boat Race is a reminder of how culture can unite and inspire through sports. Kudos to the Organizing Committee and entire team for their relentless commitment to fostering understanding, celebrating heritage, and strengthening Indo-Canadian bond. A cultural masterpiece! \ud83d\ude4c\ud83c\udf1f #CelebrateCulture #BoatRace2025"
            },
            shareMediaCategory: "IMAGE",
            media: [
              {
                status: "READY",
                media: asset,
                title: {
                  text: "Test now"
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
    // \ud83d\udd34 END TESTING POST ONLY — REMOVE THIS BLOCK FOR PRODUCTION USE

    //res.send(`<h2>\u2705 Posted. - Thank you for sharing ! - Team Panorama</h2><img src="/output_${profile.sub}.png" width="300">`);
    //or use this one 
    res.send(`<h2 style="font-size: 14px; font-weight: bold;">\u2705 Posted. - Thank you for sharing! </h2><img src="/output_${profile.sub}.png" width="300">`);

  } catch (err) {
    if (err.response) {
      console.error("OAuth/Posting error response:", err.response.data);
      res.status(500).send(`Error: ${JSON.stringify(err.response.data)}`);
    } else {
      console.error("OAuth/Posting error:", err.message);
      res.status(500).send(`Error: ${err.message}`);
    }
  }
});

app.listen(port, () => {
  console.log(`\u2705 Server running at http://localhost:${port}`);
});
