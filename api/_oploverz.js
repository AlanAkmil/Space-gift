import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";

const BASE = "https://vip.oploverz.ltd";
const BACKAPI = "https://backapi.oploverz.ac/uploads/";
const TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}
function randomDelay(min = 100, max = 800) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getHeaders() {
  const ua = randomUA();
  return {
    "User-Agent": ua,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
    "Sec-Ch-Ua": '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Referer": "https://vip.oploverz.ltd/",
    "Origin": "https://vip.oploverz.ltd",
  };
}

const http = axios.create({
  baseURL: BASE,
  timeout: TIMEOUT,
  withCredentials: true,
  httpsAgent: new https.Agent({ rejectUnauthorized: false, keepAlive: true }),
});

const AD_DOMAINS = [
  "blogger.com", "blogspot.com", "paladindrama",
  "glamour", "mayhap", "histats",
  "slot", "casino", "mpo", "judol",
  "placehold.co", "comentario", "cloudflareinsights",
];

function isClean(url = "") {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !AD_DOMAINS.some(d => lower.includes(d));
}

function decodeSvelteFlat(raw) {
  if (!raw || !Array.isArray(raw.nodes)) return null;
  const dataNode = raw.nodes.find(n => n?.type === "data" && Array.isArray(n.data));
  if (!dataNode) return null;
  const arr = dataNode.data;
  function resolve(idx) {
    if (idx === null || idx === undefined) return null;
    const val = arr[idx];
    if (val === null || val === undefined) return val;
    if (typeof val !== "object") return val;
    if (Array.isArray(val)) return val.map(i => resolve(i));
    const result = {};
    for (const [k, v] of Object.entries(val)) result[k] = resolve(v);
    return result;
  }
  return resolve(0);
}

async function fetchDataJson(path, referer, retries = MAX_RETRIES) {
  const endpoint = (path === "/" ? "" : path) + "/__data.json?x-sveltekit-invalidated=001";
  for (let i = 0; i < retries; i++) {
    try {
      const headers = getHeaders();
      headers.Referer = referer || BASE + "/";
      const res = await http.get(endpoint, { headers });
      if (res.status === 403 || res.status === 503) throw new Error(`Blocked (${res.status})`);
      return decodeSvelteFlat(res.data);
    } catch (e) {
      if (i === retries - 1) throw e;
      const delay = RETRY_DELAY * Math.pow(2, i) + randomDelay(0, 300);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function fetchHTML(path, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await http.get(path, { headers: getHeaders() });
      if (res.status === 403 || res.status === 503) throw new Error(`Blocked (${res.status})`);
      return res.data;
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, RETRY_DELAY * Math.pow(2, i)));
    }
  }
}

function fullUrl(path) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return BACKAPI + path;
}

function fmtStreamUrls(streamUrl = []) {
  return (streamUrl || [])
    .filter(s => s?.url && isClean(s.url))
    .map(s => ({ label: s.source, url: s.url }));
}

function fmtDownloads(downloadUrl = []) {
  return (downloadUrl || []).flatMap(fmt =>
    (fmt?.resolutions || []).flatMap(res =>
      (res?.download_links || [])
        .filter(l => l?.url && isClean(l.url))
        .map(l => ({
          format: fmt.format || null,
          quality: res.quality || null,
          host: l.host || null,
          url: l.url,
        }))
    )
  );
}

function fmtSeries(s) {
  if (!s?.slug) return null;
  return {
    id: s.id || null,
    title: s.title || null,
    japaneseTitle: s.japaneseTitle || null,
    slug: s.slug,
    status: s.status || null,
    poster: fullUrl(s.poster),
    score: s.score || null,
    genres: (s.genres || []).map(g => g?.name || g).filter(Boolean),
    studio: s.studio?.name || null,
    season: s.season?.name || null,
    totalEpisodes: s.totalEpisodes || null,
    releaseDate: s.releaseDate || null,
    releaseType: s.releaseType || null,
    source: "oploverz",
    url: `${BASE}/series/${s.slug}`,
  };
}

export async function oploverzHome() {
  const decoded = await fetchDataJson("/", BASE + "/");
  if (!decoded) throw new Error("Gagal decode home");
  return {
    trending: (decoded.trending?.data || []).map(fmtSeries).filter(Boolean),
    recently: (decoded.recently?.data || []).map(fmtSeries).filter(Boolean),
    latestEpisodes: (decoded.latestEpisodes?.data || []).map(ep => {
      if (!ep) return null;
      return {
        id: ep.id || null,
        seriesTitle: ep.series?.title || null,
        seriesSlug: ep.series?.slug || null,
        episodeNumber: ep.episodeNumber || null,
        subbed: ep.subbed || null,
        poster: fullUrl(ep.series?.poster) || null,
        releasedAt: ep.releasedAt || null,
        source: "oploverz",
        url: ep.series?.slug
          ? `${BASE}/series/${ep.series.slug}/episode/${ep.episodeNumber}`
          : null,
      };
    }).filter(Boolean),
  };
}

export async function oploverzSearch(query, limit = 20) {
  const decoded = await fetchDataJson(`/search?q=${encodeURIComponent(query)}`, BASE + "/");
  let items = (decoded?.allSeries?.data || []).map(s => fmtSeries(s)).filter(Boolean);
  if (!items.length) {
    const html = await fetchHTML(`/search?q=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    $("a[href^='/series/']").each((_, el) => {
      const slug = $(el).attr("href")?.replace("/series/", "").replace(/\/.*/, "");
      const title = $(el).find("img").attr("alt") || "";
      const img = $(el).find("img").attr("src") || null;
      if (slug && title && !items.find(x => x.slug === slug))
        items.push({ slug, title, poster: fullUrl(img), source: "oploverz", url: `${BASE}/series/${slug}` });
    });
  }
  return items.slice(0, limit);
}

export async function oploverzSeries(page = 1, sort_by = "recently", genre = "", limit = 20) {
  const query = new URLSearchParams({ page, sort_by, ...(genre && { genre }) });
  const decoded = await fetchDataJson(`/series?${query}`, BASE + "/");
  let items = (decoded?.allSeries?.data || []).map(s => fmtSeries(s)).filter(Boolean);
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    total,
    pagination: { currentPage: page, lastPage: Math.ceil(total / limit) || 1, perPage: limit },
    items: items.slice(start, start + limit),
  };
}

export async function oploverzDetail(slug) {
  const decoded = await fetchDataJson(`/series/${slug}`, BASE + "/");
  if (!decoded) throw new Error(`Gagal decode detail: ${slug}`);
  const s = decoded.series || {};
  const eps = decoded.episodes || {};
  const epList = eps.data || eps || [];
  return {
    id: s.id || null,
    title: s.title || null,
    japaneseTitle: s.japaneseTitle || null,
    slug,
    description: s.description || null,
    status: s.status || null,
    poster: fullUrl(s.poster),
    score: s.score || null,
    genres: (s.genres || []).map(g => g?.name || g).filter(Boolean),
    studio: s.studio?.name || null,
    season: s.season?.name || null,
    totalEpisodes: s.totalEpisodes || epList.length,
    releaseDate: s.releaseDate || null,
    releaseType: s.releaseType || null,
    source: "oploverz",
    episodes: Array.isArray(epList)
      ? epList.map(ep => ({
          episodeNumber: ep.episodeNumber || null,
          title: ep.title || null,
          releasedAt: ep.releasedAt || null,
          url: `${BASE}/series/${slug}/episode/${ep.episodeNumber}`,
        })).filter(ep => ep.episodeNumber)
          .sort((a, b) => +a.episodeNumber - +b.episodeNumber)
      : [],
    url: `${BASE}/series/${slug}`,
  };
}

export async function oploverzWatch(slug, epNumber) {
  const decoded = await fetchDataJson(
    `/series/${slug}/episode/${epNumber}`,
    `${BASE}/series/${slug}`
  );
  if (!decoded) throw new Error(`Gagal decode watch: ${slug} ep ${epNumber}`);
  const ep = decoded.episode || {};
  const allList = (decoded.allEpisodes?.data || decoded.allEpisodes || decoded.episodes?.data || []);
  return {
    id: ep.id || null,
    seriesTitle: ep.series?.title || decoded.series?.title || null,
    seriesSlug: ep.series?.slug || slug,
    episodeNumber: ep.episodeNumber || epNumber,
    subbed: ep.subbed || null,
    poster: fullUrl(ep.series?.poster) || null,
    releasedAt: ep.releasedAt || null,
    streamUrls: fmtStreamUrls(ep.streamUrl),
    downloadUrls: fmtDownloads(ep.downloadUrl),
    source: "oploverz",
    allEpisodes: Array.isArray(allList)
      ? allList.map(e => ({
          episodeNumber: e.episodeNumber || null,
          releasedAt: e.releasedAt || null,
          url: `${BASE}/series/${slug}/episode/${e.episodeNumber}`,
        })).filter(e => e.episodeNumber)
          .sort((a, b) => +a.episodeNumber - +b.episodeNumber)
      : [],
    url: `${BASE}/series/${slug}/episode/${epNumber}`,
  };
}
