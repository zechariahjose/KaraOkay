const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const fallbackSongs = [
  ['Dancing Queen', 'ABBA', 'xFrGuyw1V8s'],
  ['Bohemian Rhapsody', 'Queen', 'fJ9rUzIMcZQ'],
  ["Don't Stop Believin'", 'Journey', '1k8craCGpgs'],
  ['Shallow', 'Lady Gaga & Bradley Cooper', 'bo_efYhYU2A'],
  ['Perfect', 'Ed Sheeran', '2Vv-BfVoR4g'],
  ['Mr. Brightside', 'The Killers', 'gGdGFtwCNBE'],
  ['Total Eclipse of the Heart', 'Bonnie Tyler', 'l4n3E3_hS9w'],
];

function buildFallbackResults(query) {
  const normalized = String(query || '').trim().toLowerCase();
  const matches = fallbackSongs.filter(([title, artist]) => {
    if (!normalized) return true;
    const titleMatch = title.toLowerCase().includes(normalized);
    const artistMatch = artist.toLowerCase().includes(normalized);
    const firstWord = title.toLowerCase().split(/\s+/)[0];
    return titleMatch || artistMatch || normalized.includes(firstWord);
  });

  const items = (matches.length ? matches : fallbackSongs).slice(0, 5).map(([title, artist, id]) => ({
    id,
    title,
    channel: artist,
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  }));

  return items;
}

app.disable('x-powered-by');
app.use(express.static(__dirname));

app.get('/api/youtube', async (req, res) => {
  const q = String((req.query && req.query.q) || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'missing q' });
  }

  const youtubeKey = process.env.YOUTUBE_API_KEY;

  if (!youtubeKey) {
    return res.status(200).json({ items: buildFallbackResults(q) });
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    maxResults: '5',
    q: `${q} karaoke instrumental`,
    key: youtubeKey,
  });

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const payload = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: payload.error?.message || 'youtube_error' });
    }

    return res.status(200).json({
      items: (payload.items || []).map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumb: item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default)?.url,
      })),
    });
  } catch (error) {
    return res.status(502).json({ error: 'fetch_failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`KaraOkay is running at http://localhost:${PORT}`);
});
