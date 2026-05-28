const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
 
let cachedToken = null;
let tokenExpiry = 0;
 
async function getSpotifyToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
 
  const creds = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString('base64');
 
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
 
  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}
 
// Track ID로 preview_url 가져오기
async function getPreviewUrl(trackId) {
  try {
    const token = await getSpotifyToken();
    const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return data.preview_url || null;
  } catch (e) {
    console.error(`[Spotify] Failed to get preview for ${trackId}:`, e.message);
    return null;
  }
}
 
module.exports = { getSpotifyToken, getPreviewUrl };
