import { oploverzSeries } from './_oploverz.js';
import { gomunimeOngoing, gomunimeCompleted } from './_gomunime.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { page = 1, sort = 'recently', genre = '', limit = 20, status } = req.query;

  try {
    // If status filter for ongoing/completed, use gomunime as it has better support
    if (status === 'ongoing' || status === 'completed') {
      try {
        const fn = status === 'ongoing' ? gomunimeOngoing : gomunimeCompleted;
        const items = await fn();
        const p = parseInt(page);
        const l = parseInt(limit);
        const start = (p - 1) * l;
        return res.status(200).json({
          success: true,
          total: items.length,
          pagination: { currentPage: p, lastPage: Math.ceil(items.length / l), perPage: l },
          items: items.slice(start, start + l),
          source: 'gomunime',
        });
      } catch (e) {
        console.error('Gomunime status failed:', e.message);
      }
    }

    // Default: use oploverz
    try {
      const data = await oploverzSeries(parseInt(page), sort, genre, parseInt(limit));
      return res.status(200).json({ success: true, ...data, source: 'oploverz' });
    } catch (e) {
      console.error('Oploverz series failed:', e.message);
      // Fallback gomunime home
      const items = await (genre ? (await import('./_gomunime.js')).gomunimeGenre(genre) : gomunimeOngoing());
      const p = parseInt(page);
      const l = parseInt(limit);
      const start = (p - 1) * l;
      return res.status(200).json({
        success: true,
        total: items.length,
        pagination: { currentPage: p, lastPage: Math.ceil(items.length / l), perPage: l },
        items: items.slice(start, start + l),
        source: 'gomunime',
      });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
