import axios from 'axios';
import * as cheerio from 'cheerio';
import https from 'https';

const BASE = 'https://gomunime.top';
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
];

function randomUA() { return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]; }
function randomDelay(min = 300, max = 1000) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function getHeaders() {
  return {
    'User-Agent': randomUA(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Referer': 'https://gomunime.top/',
    'Origin': 'https://gomunime.top',
  };
}

async function fetchHTML(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url, {
        headers: getHeaders(),
        timeout: 20000,
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      });
      if (res.status === 403 || res.status === 503) throw new Error(`Blocked (${res.status})`);
      return cheerio.load(res.data);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, BASE_DELAY * Math.pow(2, i) + randomDelay(0, 300)));
    }
  }
}

function cleanUrl(url) {
  if (!url) return null;
  url = url.trim().replace(/,$/, '');
  if (url.startsWith('//')) return 'https:' + url;
  if (url.startsWith('/')) return BASE + url;
  if (url.startsWith('http')) return url;
  return null;
}

function extractAnimeList($) {
  const items = [];
  const images = $('img[src*="poster"], img[data-src*="poster"], img[src*="banner"], img[data-src*="banner"]');
  images.each((_, el) => {
    const img = $(el);
    const src = img.attr('src') || img.attr('data-src');
    if (!src) return;
    const poster = cleanUrl(src);
    if (!poster) return;
    let linkEl = img.closest('a');
    if (!linkEl.length) linkEl = img.parent().find('a').first();
    if (!linkEl.length) return;
    const href = linkEl.attr('href');
    if (!href || href === '/' || href.length < 3) return;
    if (href.includes('/b/') || href.includes('banner') || href.includes('7METER')) return;
    if (href.includes('search') || href.includes('genre') || href.includes('#')) return;
    const link = cleanUrl(href);
    if (!link) return;
    let title = img.attr('alt') || linkEl.text().trim() || href.split('/').pop().replace(/-/g, ' ');
    if (title.toLowerCase().includes('7meter') || title.toLowerCase().includes('banner')) return;
    const slug = href.replace(/^\//, '').replace(/\/$/, '');
    items.push({ title: title.substring(0, 100), slug, poster, source: 'gomunime', url: link });
  });
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export async function gomunimeHome() {
  const $ = await fetchHTML(BASE);
  return extractAnimeList($);
}

export async function gomunimeSearch(query) {
  const $ = await fetchHTML(`${BASE}/search?q=${encodeURIComponent(query)}`);
  return extractAnimeList($);
}

export async function gomunimeOngoing() {
  const $ = await fetchHTML(`${BASE}/status/ongoing`);
  return extractAnimeList($);
}

export async function gomunimeCompleted() {
  const $ = await fetchHTML(`${BASE}/status/completed`);
  return extractAnimeList($);
}

export async function gomunimeGenre(genre) {
  const $ = await fetchHTML(`${BASE}/genre/${genre}`);
  return extractAnimeList($);
}

export async function gomunimeDetail(slug) {
  const url = `${BASE}/${slug}`;
  const $ = await fetchHTML(url);
  let title = $('meta[property="og:title"]').attr('content') || $('title').text().trim();
  title = title.replace(/\s*\|\s*Gomunime$/, '').trim();
  const poster = cleanUrl($('meta[property="og:image"]').attr('content'));
  const description = $('meta[property="og:description"]').attr('content') || '';
  const rating = description.match(/rating\s*([\d.]+)/i)?.[1] || null;
  const status = description.match(/status\s*(\w+)/i)?.[1] || null;

  const eps = new Set();
  $('a[href*="episode-"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href.includes('episode-')) {
      const full = cleanUrl(href);
      if (full) eps.add(full);
    }
  });
  const episodeList = Array.from(eps)
    .sort((a, b) => {
      const na = parseInt(a.match(/episode-(\d+)/)?.[1] || '0', 10);
      const nb = parseInt(b.match(/episode-(\d+)/)?.[1] || '0', 10);
      return na - nb;
    })
    .map(epUrl => ({
      episodeNumber: epUrl.match(/episode-(\d+)/)?.[1] || '0',
      url: epUrl,
    }));

  return {
    title, slug, poster, description, rating, status,
    totalEpisodes: episodeList.length,
    source: 'gomunime',
    episodes: episodeList,
    url,
  };
}

export async function gomunimeWatch(episodeUrl) {
  const $ = await fetchHTML(episodeUrl);
  const iframes = [];
  $('iframe').each((_, el) => {
    const src = $(el).attr('src');
    if (src) { const c = cleanUrl(src); if (c) iframes.push(c); }
  });
  return { streamUrls: [...new Set(iframes)].map(u => ({ label: 'Stream', url: u })), source: 'gomunime' };
}
