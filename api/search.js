import { oploverzSearch } from './_oploverz.js';
import { gomunimeSearch } from './_gomunime.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { q = '', limit = 20 } = req.query;
  if (!q) return res.status(400).json({ success: false, error: 'Query required' });

  try {
    let items = [];

    // Try oploverz first
    try {
      const oplo = await oploverzSearch(q, parseInt(limit));
      items = oplo;
    } catch (e) {
      console.error('Oploverz search failed:', e.message);
    }

    // Always also search gomunime and merge (dedup by title)
    try {
      const gomu = await gomunimeSearch(q);
      const existingTitles = new Set(items.map(i => i.title?.toLowerCase()));
      const newItems = gomu.filter(g => !existingTitles.has(g.title?.toLowerCase()));
      items = [...items, ...newItems];
    } catch (e) {
      console.error('Gomunime search failed:', e.message);
    }

    res.status(200).json({
      success: true,
      query: q,
      total: items.length,
      items: items.slice(0, parseInt(limit)),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
