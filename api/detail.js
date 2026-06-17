import { oploverzDetail } from './_oploverz.js';
import { gomunimeDetail } from './_gomunime.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { slug, source } = req.query;
  if (!slug) return res.status(400).json({ success: false, error: 'Slug required' });

  try {
    // If source specified, use that
    if (source === 'gomunime') {
      const data = await gomunimeDetail(slug);
      return res.status(200).json({ success: true, data });
    }

    // Try oploverz first
    try {
      const data = await oploverzDetail(slug);
      return res.status(200).json({ success: true, data });
    } catch (e) {
      console.error('Oploverz detail failed, trying gomunime:', e.message);
      const data = await gomunimeDetail(slug);
      return res.status(200).json({ success: true, data });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
