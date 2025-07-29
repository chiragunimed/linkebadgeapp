const axios = require('axios');

async function getProfile(accessToken) {
  const profile = await axios.get('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const pic = await axios.get(
    'https://api.linkedin.com/v2/me?projection=(profilePicture(displayImage~:playableStreams))',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const picUrl = pic.data.profilePicture['displayImage~'].elements.pop().identifiers[0].identifier;

  return {
    name: profile.data.localizedFirstName,
    profilePicUrl: picUrl,
    urn: profile.data.id,
  };
}

async function postToLinkedIn(accessToken, userId, badgeUrl) {
  return axios.post(
    'https://api.linkedin.com/v2/ugcPosts',
    {
      author: `urn:li:person:${userId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: "Excited to attend TiEQuest Summit 2025!" },
          shareMediaCategory: 'IMAGE',
          media: [
            {
              status: 'READY',
              media: badgeUrl,
              title: { text: 'My Event Badge' },
            },
          ],
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    }
  );
}

module.exports = { getProfile, postToLinkedIn };
