import { oploverzWatch } from './_oploverz.js';
import { gomunimeWatch } from './_gomunime.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { slug, ep, source, episodeUrl } = req.query;

  try {
    // Gomunime watch (by full episodeUrl)
    if (source === 'gomunime' && episodeUrl) {
      const data = await gomunimeWatch(episodeUrl);
      return res.status(200).json({ success: true, data });
    }

    if (!slug || !ep) return res.status(400).json({ success: false, error: 'slug and ep required' });

    // Try oploverz
    try {
      const data = await oploverzWatch(slug, ep);
      return res.status(200).json({ success: true, data });
    } catch (e) {
      console.error('Oploverz watch failed:', e.message);
      // Try gomunime as fallback using constructed URL
      const epUrl = `https://gomunime.top/${slug}-episode-${ep}`;
      const data = await gomunimeWatch(epUrl);
      return res.status(200).json({ success: true, data });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
