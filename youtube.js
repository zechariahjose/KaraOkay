// Vercel serverless function: finds karaoke/instrumental videos on YouTube.
// Needs the YOUTUBE_API_KEY environment variable (YouTube Data API v3).
module.exports = async (req, res) => {
  const q = String((req.query && req.query.q) || '').slice(0, 150).trim();
  if (!q) return res.status(400).json({ error: 'missing q' });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(501).json({ error: 'no_key' });

  const params = new URLSearchParams({
    part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true',
    maxResults: '5', q: q + ' karaoke instrumental', key,
  });
  try {
    const r = await fetch('https://www.googleapis.com/youtube/v3/search?' + params);
    const j = await r.json();
    if (!r.ok) return res.status(502).json({ error: (j.error && j.error.message) || 'youtube_error' });
    // Cache a day so repeat searches don't burn quota (100 units per search, 10,000/day free).
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json({
      items: (j.items || []).map(i => ({
        id: i.id.videoId,
        title: i.snippet.title,
        channel: i.snippet.channelTitle,
        thumb: i.snippet.thumbnails && (i.snippet.thumbnails.medium || i.snippet.thumbnails.default).url,
      })),
    });
  } catch (e) {
    return res.status(502).json({ error: 'fetch_failed' });
  }
};