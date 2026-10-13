#!/usr/bin/env node
// Capture a website (live URL or a local built `dist/` folder) for the pipeline. No LLM involved.
//
//   node scripts/capture.mjs <url|dist-dir> [--out runs/<slug>/before] [--content]
//
// Writes to <out>:
//   shots/desktop-fold.jpg   1440x900 first screen (downscaled to 1280 wide)
//   shots/mobile-fold.jpg    390x844 first screen
//   shots/full-N.jpg         full page at 720px wide, sliced into <=5 tiles (bounded image tokens)
//   metrics.json             perf (LCP, CLS, weight, requests), accessibility (axe), structural checks
//   content.json             (--content) compact text/brand summary + downloaded assets in ../assets
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import { serveDir } from './lib/serve.mjs';
import { extractInPage, extractTextInPage } from './lib/extract.mjs';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i > -1 ? args[i + 1] : d; };
if (!target) { console.error('usage: capture.mjs <url|dist-dir> [--out dir] [--content]'); process.exit(1); }

const slugify = (u) => new URL(u).hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase();

const isLocal = fs.existsSync(target) && fs.statSync(target).isDirectory();
let server = null;
let url = target;
if (isLocal) { server = await serveDir(target); url = server.url; }
else if (!/^https?:\/\//.test(url)) url = `https://${url}`;

const out = opt('out', path.join('runs', isLocal ? path.basename(path.resolve(target, '..')) : slugify(url), 'before'));
const shots = path.join(out, 'shots');
fs.mkdirSync(shots, { recursive: true });

const MAX_TILES = 5, TILE_W = 720, TILE_H = 1100;
const browser = await chromium.launch();

async function load(page) {
  try { await page.goto(url, { waitUntil: 'load', timeout: 45000 }); }
  catch { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 }); }
  await page.waitForLoadState('networkidle', { timeout: 6000 }).catch(() => {});
  // Dismiss cookie/consent banners so they don't cover the screenshot.
  for (const re of [/^accept( all)?( cookies)?$/i, /^(i )?agree$/i, /^got it$/i, /^allow all$/i, /^ok$/i]) {
    const b = page.getByRole('button', { name: re }).first();
    if (await b.isVisible().catch(() => false)) { await b.click({ timeout: 1500 }).catch(() => {}); break; }
  }
}

async function scrollThrough(page) {
  // Trigger lazy-loaded images, then return to top.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight && y < 20000; y += step) {
      window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

const ctxOpts = { reducedMotion: 'reduce', ignoreHTTPSErrors: true,
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36' };

// ---------- Desktop: perf + screenshots + content ----------
const desktop = await browser.newContext({ ...ctxOpts, viewport: { width: 1440, height: 900 } });
await desktop.addInitScript(() => {
  window.__lcp = 0; window.__cls = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
});
const page = await desktop.newPage();
let bytes = 0, requests = 0; const pending = [];
page.on('requestfinished', (r) => { requests++; pending.push(r.sizes().then((s) => { bytes += s.responseBodySize; }).catch(() => {})); });

const t0 = Date.now();
await load(page);
const loadMs = Date.now() - t0;
const perf = await page.evaluate(() => ({
  lcpMs: Math.round(window.__lcp),
  cls: +window.__cls.toFixed(3),
  domContentLoadedMs: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0),
}));
await page.screenshot({ path: path.join(shots, 'desktop-fold.png') });
await scrollThrough(page);
await Promise.all(pending);

const content = flag('content') ? await page.evaluate(extractInPage) : null;
const checks = content?.checks ?? (await page.evaluate(extractInPage)).checks;

const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze().catch(() => null);
const a11y = axe ? {
  violations: axe.violations.length,
  byImpact: axe.violations.reduce((o, v) => ((o[v.impact] = (o[v.impact] || 0) + v.nodes.length), o), {}),
  top: axe.violations.slice(0, 8).map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`),
} : null;

const fullPng = await page.screenshot({ fullPage: true });

// ---------- Mobile ----------
const mobile = await browser.newContext({ ...ctxOpts, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' });
const mpage = await mobile.newPage();
await load(mpage);
await mpage.screenshot({ path: path.join(shots, 'mobile-fold.png') });
const mobileChecks = await mpage.evaluate(() => ({
  horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
  smallestTapTargetPx: Math.min(999, ...[...document.querySelectorAll('a,button')].map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.top < window.innerHeight).map((r) => Math.min(r.width, r.height))),
  bodyFontPx: parseFloat(getComputedStyle(document.body).fontSize),
}));

// ---------- Secondary pages (text only, only for the source site) ----------
if (content && !isLocal) {
  const host = new URL(url).hostname;
  const wanted = content.nav.filter((l) => /about|service|treatment|menu|practice|what we do|contact|team|pricing/i.test(l.text))
    .filter((l) => { try { return new URL(l.href).hostname === host; } catch { return false; } }).slice(0, 3);
  content.subpages = [];
  for (const l of wanted) {
    try {
      await page.goto(l.href, { waitUntil: 'domcontentloaded', timeout: 20000 });
      content.subpages.push({ title: l.text, url: l.href, text: await page.evaluate(extractTextInPage) });
    } catch {}
  }
}

// ---------- Assets (logo + main images) ----------
if (content && !isLocal) {
  const assetDir = path.join(out, '..', 'assets');
  fs.mkdirSync(assetDir, { recursive: true });
  const save = async (src, name) => {
    try {
      const res = await desktop.request.get(src, { timeout: 15000 });
      if (!res.ok()) return null;
      const buf = await res.body();
      const type = res.headers()['content-type'] || '';
      if (type.includes('svg') || src.toLowerCase().split('?')[0].endsWith('.svg')) {
        fs.writeFileSync(path.join(assetDir, `${name}.svg`), buf); return `${name}.svg`;
      }
      const img = sharp(buf); const m = await img.metadata();
      const file = `${name}.${name === 'logo' ? 'png' : 'webp'}`;
      const pipe = img.resize({ width: Math.min(m.width || 1920, name === 'logo' ? 800 : 1920), withoutEnlargement: true });
      await (name === 'logo' ? pipe.png() : pipe.webp({ quality: 80 })).toFile(path.join(assetDir, file));
      return file;
    } catch { return null; }
  };
  if (content.logo) content.logo.file = await save(content.logo.src, 'logo');
  let i = 1;
  for (const img of content.images) img.file = await save(img.src, `img-${String(i++).padStart(2, '0')}`);
  content.images = content.images.filter((im) => im.file);
}

await browser.close();
server?.close();

// ---------- Image post-processing: bounded sizes for cheap vision tokens ----------
const toJpg = async (src, dest, width) => {
  await sharp(src).resize({ width, withoutEnlargement: true }).jpeg({ quality: 72 }).toFile(dest);
  fs.rmSync(src);
};
await toJpg(path.join(shots, 'desktop-fold.png'), path.join(shots, 'desktop-fold.jpg'), 1280);
await toJpg(path.join(shots, 'mobile-fold.png'), path.join(shots, 'mobile-fold.jpg'), 390);
for (const f of fs.readdirSync(shots)) if (f.startsWith('full-')) fs.rmSync(path.join(shots, f));
const scaled = await sharp(fullPng).resize({ width: TILE_W }).png().toBuffer();
const { height } = await sharp(scaled).metadata();
const tiles = Math.min(MAX_TILES, Math.ceil(height / TILE_H));
// If the page is taller than MAX_TILES tiles, shrink further so the whole page still fits.
const fit = height > MAX_TILES * TILE_H ? await sharp(scaled).resize({ height: MAX_TILES * TILE_H }).png().toBuffer() : scaled;
const fitMeta = await sharp(fit).metadata();
for (let t = 0; t < tiles; t++) {
  const top = t * TILE_H; const h = Math.min(TILE_H, fitMeta.height - top);
  if (h <= 20) break;
  await sharp(fit).extract({ left: 0, top, width: fitMeta.width, height: h }).jpeg({ quality: 70 }).toFile(path.join(shots, `full-${t + 1}.jpg`));
}

const metrics = { url: isLocal ? target : url, capturedAt: new Date().toISOString(),
  perf: { ...perf, loadMs, transferKB: Math.round(bytes / 1024), requests }, a11y, checks, mobile: mobileChecks };
fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(metrics, null, 2));
if (content) { delete content.checks; fs.writeFileSync(path.join(out, 'content.json'), JSON.stringify(content, null, 2)); }

console.log(JSON.stringify({ out, shots: fs.readdirSync(shots), perf: metrics.perf, a11yViolations: a11y?.violations, checks, mobile: mobileChecks }));
