const express = require('express');
const path = require('path');

const app = express();
const preferredPort = Number(process.env.PORT || 3000);
const candidatePorts = Array.from(new Set([preferredPort, preferredPort + 1, preferredPort + 2, preferredPort + 3, 3001]));

function startServer(portIndex = 0) {
  const port = candidatePorts[portIndex];
  const server = app.listen(port, () => {
    console.log(`KaraOkay is running at http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && portIndex < candidatePorts.length - 1) {
      console.warn(`Port ${port} is busy. Retrying on http://localhost:${candidatePorts[portIndex + 1]}...`);
      startServer(portIndex + 1);
      return;
    }
    throw error;
  });
}

const karaokePattern = /\b(karaoke|instrumental|minus[ -]?one|backing track|no vocals?|vocals? removed)\b/i;
function karaokeScore(item) {
  const text = `${item.title} ${item.channel}`;
  if (!karaokePattern.test(text)) return -1;
  let score = 0;
  if (/\bkaraoke\b/i.test(text)) score += 5;
  if (/\bminus[ -]?one\b/i.test(text)) score += 6;
  if (/\binstrumental\b/i.test(text)) score += 4;
  if (/\b(backing track|no vocals?|vocals? removed)\b/i.test(text)) score += 3;
  if (/\b(official video|music video|live|lyrics?)\b/i.test(text)) score -= 5;
  return score;
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
    return res.status(200).json({ items: [] });
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoSyndicated: 'true',
    maxResults: '10',
    q: `${q} karaoke instrumental minus one backing track`,
    key: youtubeKey,
  });

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const payload = await response.json();

    if (!response.ok) {
      return res.status(502).json({ error: payload.error?.message || 'youtube_error' });
    }

    const items = (payload.items || []).map((item) => ({
        id: item.id.videoId,
        title: item.snippet.title,
        channel: item.snippet.channelTitle,
        thumb: item.snippet.thumbnails && (item.snippet.thumbnails.medium || item.snippet.thumbnails.default)?.url,
      })).map((item) => ({ ...item, score: karaokeScore(item) }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ score, ...item }) => item);
    return res.status(200).json({ items });
  } catch (error) {
    return res.status(502).json({ error: 'fetch_failed' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

startServer();
