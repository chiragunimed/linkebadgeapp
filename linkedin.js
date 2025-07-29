const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp'); // for image processing

async function fetchLinkedInProfile(accessToken) {
  const res = await axios.get('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const profile = res.data;

  const picRes = await axios.get('https://api.linkedin.com/v2/me?projection=(profilePicture(displayImage~:playableStreams))', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const displayImage = picRes.data.profilePicture['displayImage~'].elements[0].identifiers[0].identifier;

  return {
    name: `${profile.localizedFirstName} ${profile.localizedLastName}`,
    imageUrl: displayImage
  };
}

async function generateBadge(profile, email) {
  const outputPath = path.join(process.env.OUTPUT_DIR, `${email}.png`);
  const inputImage = process.env.BASE_IMAGE_PATH;

  const profileImgRes = await axios.get(profile.imageUrl, { responseType: 'arraybuffer' });

  await sharp(inputImage)
    .composite([{ input: Buffer.from(profileImgRes.data), gravity: 'southeast', blend: 'over' }])
    .toFile(outputPath);

  return outputPath;
}

module.exports = { fetchLinkedInProfile, generateBadge };
