export default async function handler(req, res) {
  const text = req.query?.text || req.body?.text || '';
  if (!text) return res.status(400).json({ error: 'text required' });

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=id&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Google TTS returned ${response.status}`);

    const audioBuffer = await response.arrayBuffer();

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(Buffer.from(audioBuffer));
  } catch (e) {
    console.error('TTS proxy error:', e.message);
    res.status(502).json({ error: 'Failed to fetch TTS audio' });
  }
}
