import { oploverzHome } from './_oploverz.js';
import { gomunimeHome } from './_gomunime.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  try {
    // Try oploverz first (more structured data)
    let data;
    try {
      data = await oploverzHome();
    } catch (e) {
      console.error('Oploverz home failed:', e.message);
      // Fallback to gomunime
      const gomuItems = await gomunimeHome();
      data = {
        trending: gomuItems.slice(0, 10),
        recently: gomuItems.slice(10, 20),
        latestEpisodes: [],
      };
    }

    // Enrich latestEpisodes with gomunime if oploverz has none
    if (!data.latestEpisodes?.length) {
      try {
        const gomu = await gomunimeHome();
        data.latestEpisodes = gomu.slice(0, 12).map(item => ({
          seriesTitle: item.title,
          seriesSlug: item.slug,
          episodeNumber: '?',
          poster: item.poster,
          source: 'gomunime',
          url: item.url,
        }));
      } catch (_) {}
    }

    res.status(200).json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
