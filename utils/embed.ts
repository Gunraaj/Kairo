export type MediaEmbed = { url: string; provider: 'youtube' | 'spotify' };

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,80}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{10,64}$/;

export const parseMediaEmbed = (input: string): MediaEmbed | null => {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.toLowerCase();

  if (host === 'youtu.be') {
    const videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
    return VIDEO_ID.test(videoId)
      ? { provider: 'youtube', url: `https://www.youtube-nocookie.com/embed/${videoId}` }
      : null;
  }

  if (YOUTUBE_HOSTS.has(host)) {
    const playlistId = parsed.searchParams.get('list') ?? '';
    if (PLAYLIST_ID.test(playlistId)) {
      return {
        provider: 'youtube',
        url: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}`,
      };
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    const videoId = parsed.searchParams.get('v')
      ?? (parts[0] === 'live' || parts[0] === 'shorts' || parts[0] === 'embed' ? parts[1] : '');
    return videoId && VIDEO_ID.test(videoId)
      ? { provider: 'youtube', url: `https://www.youtube-nocookie.com/embed/${videoId}` }
      : null;
  }

  if (host === 'open.spotify.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    const offset = parts[0] === 'embed' ? 1 : 0;
    const kind = parts[offset];
    const mediaId = parts[offset + 1] ?? '';
    const allowedKinds = new Set(['track', 'album', 'playlist', 'episode', 'show']);
    return kind && allowedKinds.has(kind) && SPOTIFY_ID.test(mediaId)
      ? { provider: 'spotify', url: `https://open.spotify.com/embed/${kind}/${mediaId}` }
      : null;
  }

  return null;
};

export const isTrustedAmbientUrl = (input: string) => {
  try {
    const url = new URL(input);
    return url.protocol === 'https:'
      && url.hostname === 'raw.githubusercontent.com'
      && url.pathname.startsWith('/remvze/moodist/main/public/sounds/');
  } catch {
    return false;
  }
};
