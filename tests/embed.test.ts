import assert from 'node:assert/strict';
import test from 'node:test';
import { isTrustedAmbientUrl, parseMediaEmbed } from '../utils/embed.ts';

test('converts supported YouTube links to privacy-enhanced embeds', () => {
  assert.deepEqual(
    parseMediaEmbed('https://www.youtube.com/watch?v=jfKfPfyJRdk'),
    {
      provider: 'youtube',
      url: 'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk',
    },
  );
  assert.equal(
    parseMediaEmbed('https://youtu.be/jfKfPfyJRdk')?.url,
    'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk',
  );
});

test('only permits expected Spotify paths', () => {
  assert.equal(
    parseMediaEmbed('https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS')?.url,
    'https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhn9wzrS',
  );
  assert.equal(parseMediaEmbed('https://spotify.com.example.com/playlist/37i9dQZF1DX8Uebhn9wzrS'), null);
});

test('rejects untrusted or non-HTTPS media URLs', () => {
  assert.equal(parseMediaEmbed('javascript:alert(1)'), null);
  assert.equal(parseMediaEmbed('http://youtube.com/watch?v=jfKfPfyJRdk'), null);
  assert.equal(parseMediaEmbed('https://example.com/watch?v=jfKfPfyJRdk'), null);
});

test('restricts ambient files to the Moodist repository path', () => {
  assert.equal(
    isTrustedAmbientUrl('https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/rain/heavy-rain.mp3'),
    true,
  );
  assert.equal(
    isTrustedAmbientUrl('https://raw.githubusercontent.com/other/repo/main/public/sounds/file.mp3'),
    false,
  );
});

test('validates and structures 1-click saved focus streams correctly', () => {
  const youtubeUrl = 'https://www.youtube.com/watch?v=4xDzrJKXOOY';
  const spotifyUrl = 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS';

  const ytEmbed = parseMediaEmbed(youtubeUrl);
  assert.ok(ytEmbed);
  assert.equal(ytEmbed.provider, 'youtube');

  const spEmbed = parseMediaEmbed(spotifyUrl);
  assert.ok(spEmbed);
  assert.equal(spEmbed.provider, 'spotify');

  const streamList = [
    {
      id: 'stream-1',
      name: 'Retro Synthwave Radio',
      subtitle: 'YouTube focus stream',
      provider: ytEmbed.provider,
      originalUrl: youtubeUrl,
      embedUrl: ytEmbed.url,
      badge: 'SYNTH',
      emoji: '⚡',
      createdAt: Date.now(),
    },
    {
      id: 'stream-2',
      name: 'Deep Focus Spotify',
      subtitle: 'Spotify playlist',
      provider: spEmbed.provider,
      originalUrl: spotifyUrl,
      embedUrl: spEmbed.url,
      badge: 'SPOTIFY',
      emoji: '🎧',
      createdAt: Date.now(),
    },
  ];

  // Serializes & deserializes safely without data loss
  const serialized = JSON.stringify(streamList);
  const deserialized = JSON.parse(serialized);
  assert.equal(deserialized.length, 2);
  assert.equal(deserialized[0].name, 'Retro Synthwave Radio');
  assert.equal(deserialized[1].badge, 'SPOTIFY');
  assert.equal(deserialized[1].embedUrl, 'https://open.spotify.com/embed/playlist/37i9dQZF1DX8Uebhn9wzrS');
});
