let cachedToken = null;
let tokenExpiry = 0;
let tokenRequest = null;

const DEFAULT_MARKET = process.env.SPOTIFY_MARKET || 'KR';

async function getSpotifyToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  if (tokenRequest) return tokenRequest;

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) return null;

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  tokenRequest = fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  })
    .then(async response => {
      if (!response.ok) {
        throw new Error(`Spotify token request failed: ${response.status}`);
      }

      const data = await response.json();
      cachedToken = data.access_token;
      tokenExpiry = Date.now() + ((data.expires_in || 3600) - 60) * 1000;
      return cachedToken;
    })
    .finally(() => {
      tokenRequest = null;
    });

  return tokenRequest;
}

async function getPreviewUrl(trackId) {
  try {
    const token = await getSpotifyToken();
    if (!token) return null;

    const track = await getTrack(trackId, token);
    if (track?.preview_url) return track.preview_url;

    return await findPreviewUrlFromSearch(track, token);
  } catch (error) {
    console.warn(`[Spotify] Failed to get preview for ${trackId}: ${error.message}`);
    return null;
  }
}

async function getTrack(trackId, token) {
  const url = new URL(`https://api.spotify.com/v1/tracks/${encodeURIComponent(trackId)}`);
  url.searchParams.set('market', DEFAULT_MARKET);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    throw new Error(`Spotify track request failed: ${response.status}`);
  }

  return await response.json();
}

async function findPreviewUrlFromSearch(track, token) {
  const title = track?.name;
  const artist = track?.artists?.[0]?.name;
  if (!title || !artist) return null;

  const url = new URL('https://api.spotify.com/v1/search');
  url.searchParams.set('type', 'track');
  url.searchParams.set('limit', '5');
  url.searchParams.set('market', DEFAULT_MARKET);
  url.searchParams.set('q', `track:${title} artist:${artist}`);

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!response.ok) {
    console.warn(`[Spotify] Search fallback failed for ${title}: ${response.status}`);
    return null;
  }

  const data = await response.json();
  return data.tracks?.items?.find(item => item.preview_url)?.preview_url || null;
}

module.exports = { getSpotifyToken, getPreviewUrl };
