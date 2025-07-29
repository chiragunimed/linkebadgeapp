// app.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { generateBadge } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/start', (req, res) => {
  const { email } = req.query;
  const scope = ['r_liteprofile', 'w_member_social'].join('%20');
  const redirect = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_REDIRECT_URI}&scope=${scope}&state=${encodeURIComponent(email)}`;
  res.redirect(redirect);
});

// Step 1: Start LinkedIn OAuth
app.get('/start', (req, res) => {
  const { email } = req.query;
  const scope = ['r_liteprofile', 'w_member_social'].join('%20');
  const redirect = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${process.env.LINKEDIN_CLIENT_ID}&redirect_uri=${process.env.LINKEDIN_REDIRECT_URI}&scope=${scope}&state=${encodeURIComponent(email)}`;
  res.redirect(redirect);
});

// Step 2: LinkedIn OAuth callback
app.get('/callback', async (req, res) => {
  const { code, state: email } = req.query;

  try {
    const tokenRes = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.LINKEDIN_REDIRECT_URI,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      },
    });

    const accessToken = tokenRes.data.access_token;

    // Step 3: Get user profile info
    const profileRes = await axios.get('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profilePicRes = await axios.get('https://api.linkedin.com/v2/me?projection=(profilePicture(displayImage~:playableStreams))', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const picElements = profilePicRes.data.profilePicture['displayImage~'].elements;
    const lastElement = picElements[picElements.length - 1];
    const profilePicUrl = lastElement.identifiers[0].identifier;

    const name = profileRes.data.localizedFirstName + ' ' + profileRes.data.localizedLastName;
    const badgePath = await generateBadge(profilePicUrl, name);

    // Step 4: Upload badge to LinkedIn
    const imageData = fs.readFileSync(badgePath);
    const uploadRes = await axios.post('https://api.linkedin.com/v2/assets?action=registerUpload', {
      registerUploadRequest: {
        owner: `urn:li:person:${profileRes.data.id}`,
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
      },
    }, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const uploadUrl = uploadRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
    const asset = uploadRes.data.value.asset;

    await axios.put(uploadUrl, imageData, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'image/png' },
    });

    // Post it
    await axios.post('https://api.linkedin.com/v2/ugcPosts', {
      author: `urn:li:person:${profileRes.data.id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: `excitement message 2025!` },
          shareMediaCategory: 'IMAGE',
          media: [{ status: 'READY', description: { text: 'yay' }, media: asset, title: { text: 'Iamattending' } }],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' },
    });

    res.send(`<h2>✅ Badge posted to LinkedIn! Thank you ${name}</h2>`);
  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send('Something went wrong.');
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
