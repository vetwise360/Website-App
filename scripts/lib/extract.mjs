// Runs inside the page (page.evaluate). Returns a compact, LLM-friendly summary of the site.
// Everything is capped so content.json stays small no matter how bloated the source site is.
export function extractInPage() {
  const vh = window.innerHeight;
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0';
  };
  const abs = (h) => { try { return new URL(h, location.href).href; } catch { return h; } };
  const top = (el) => el.getBoundingClientRect().top + window.scrollY;
  const uniq = (arr, key = (x) => x) => { const s = new Set(); return arr.filter((x) => { const k = key(x); if (s.has(k)) return false; s.add(k); return true; }); };

  const meta = (n) => document.querySelector(`meta[name="${n}"],meta[property="${n}"]`)?.content || null;

  // Navigation
  const navRoot = document.querySelector('header nav, nav, header') || document.body;
  const nav = uniq([...navRoot.querySelectorAll('a')].filter(visible)
    .map((a) => ({ text: clean(a.innerText), href: abs(a.getAttribute('href') || '') }))
    .filter((l) => l.text && l.text.length < 40), (l) => l.text.toLowerCase()).slice(0, 15);

  // Headings in document order
  const headings = [...document.querySelectorAll('h1,h2,h3')].filter(visible)
    .map((h) => ({ tag: h.tagName.toLowerCase(), text: clean(h.innerText).slice(0, 160), y: Math.round(top(h)) }))
    .filter((h) => h.text).slice(0, 40);

  // Body copy (deduped, capped)
  let budget = 7000;
  const paragraphs = [];
  for (const el of document.querySelectorAll('p, li, blockquote, dd')) {
    if (!visible(el) || el.closest('nav, footer, script, style')) continue;
    const t = clean(el.innerText);
    if (t.length < 40 || paragraphs.includes(t)) continue;
    if (budget - t.length < 0) break;
    budget -= t.length;
    paragraphs.push(t.slice(0, 600));
  }

  // CTAs
  const ctaSel = 'a[class*="btn" i], a[class*="button" i], button, [role="button"], a[href^="tel:"], input[type="submit"]';
  const ctas = uniq([...document.querySelectorAll(ctaSel)].filter(visible)
    .map((el) => ({ text: clean(el.innerText || el.value).slice(0, 60), href: el.getAttribute('href') ? abs(el.getAttribute('href')) : null, aboveFold: el.getBoundingClientRect().top < vh }))
    .filter((c) => c.text && c.text.length > 1), (c) => c.text.toLowerCase()).slice(0, 20);

  // Contact
  const all = document.body.innerText;
  const tel = uniq([...document.querySelectorAll('a[href^="tel:"]')].map((a) => a.getAttribute('href').replace('tel:', '')));
  const phonesInText = uniq(all.match(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g) || []).slice(0, 4);
  const emails = uniq([...document.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute('href').replace('mailto:', '').split('?')[0])
    .concat(all.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])).slice(0, 4);
  const address = (all.match(/\d{2,6}\s[\w .]{3,40}\b(St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Way|Ct|Pkwy|Hwy|Suite)\b[^\n]{0,60}/i) || [null])[0];
  const hours = (all.match(/(Mon(day)?|Tue|Wed|Thu|Fri|Sat|Sun)[^\n]{0,80}\d{1,2}(:\d{2})?\s?(am|pm|AM|PM)[^\n]{0,60}/) || [null])[0];
  const socials = uniq([...document.querySelectorAll('a[href]')].map((a) => a.href)
    .filter((h) => /facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok|yelp|google\.com\/maps|g\.page/i.test(h))).slice(0, 8);

  // Testimonials / reviews
  const testimonials = uniq([...document.querySelectorAll('[class*="testimonial" i], [class*="review" i], blockquote')]
    .filter(visible).map((el) => clean(el.innerText).slice(0, 400)).filter((t) => t.length > 40)).slice(0, 6);

  // Images
  const imgs = [...document.querySelectorAll('img')].filter(visible).map((img) => {
    const r = img.getBoundingClientRect();
    return { src: abs(img.currentSrc || img.src), alt: img.alt || '', w: Math.round(r.width), h: Math.round(r.height),
      inHeader: !!img.closest('header'), aboveFold: r.top < vh,
      hint: `${img.className} ${img.id} ${img.alt} ${img.src}`.toLowerCase() };
  }).filter((i) => i.src && !i.src.startsWith('data:'));
  const logo = imgs.find((i) => i.inHeader && i.hint.includes('logo')) || imgs.find((i) => i.hint.includes('logo')) || imgs.find((i) => i.inHeader) || null;
  const images = uniq(imgs.filter((i) => i !== logo && i.w * i.h > 40000).sort((a, b) => b.w * b.h - a.w * a.h), (i) => i.src)
    .slice(0, 12).map(({ hint, inHeader, ...i }) => i);

  // Colors (weighted by painted area) + fonts
  const colorArea = {};
  const textColors = {};
  const toHex = (c) => { const m = c.match(/\d+(\.\d+)?/g); if (!m || (m[3] !== undefined && +m[3] < 0.5)) return null; return '#' + m.slice(0, 3).map((n) => (+n).toString(16).padStart(2, '0')).join(''); };
  for (const el of [...document.querySelectorAll('body, body *')].slice(0, 3000)) {
    if (!visible(el)) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    const bg = toHex(cs.backgroundColor); if (bg) colorArea[bg] = (colorArea[bg] || 0) + r.width * r.height;
    if (el.childNodes[0]?.nodeType === 3 && clean(el.textContent)) { const t = toHex(cs.color); if (t) textColors[t] = (textColors[t] || 0) + 1; }
  }
  const topN = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([c]) => c);
  const btnColors = uniq([...document.querySelectorAll(ctaSel)].filter(visible).map((el) => toHex(getComputedStyle(el).backgroundColor)).filter(Boolean)).slice(0, 4);
  const font = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() : null; };

  // Quick structural/SEO checks
  const checks = {
    h1Count: document.querySelectorAll('h1').length,
    hasViewportMeta: !!document.querySelector('meta[name="viewport"]'),
    imagesMissingAlt: document.querySelectorAll('img:not([alt]), img[alt=""]').length,
    forms: document.querySelectorAll('form').length,
    ctaAboveFold: ctas.some((c) => c.aboveFold),
    clickToCall: tel.length > 0,
    pageHeight: document.documentElement.scrollHeight,
    hasSchemaOrg: !!document.querySelector('script[type="application/ld+json"]'),
  };

  return {
    title: document.title, description: meta('description'), ogImage: meta('og:image'),
    favicon: abs(document.querySelector('link[rel*="icon"]')?.getAttribute('href') || '/favicon.ico'),
    nav, headings, paragraphs, ctas, testimonials,
    contact: { phones: uniq(tel.concat(phonesInText)).slice(0, 4), emails, address, hours, socials },
    logo: logo ? { src: logo.src, alt: logo.alt, w: logo.w, h: logo.h } : null,
    images,
    style: { backgrounds: topN(colorArea, 6), text: topN(textColors, 4), buttons: btnColors,
      fonts: { body: font('body'), h1: font('h1'), h2: font('h2') } },
    checks,
  };
}

// Text-only extraction for secondary pages (about/services/contact).
export function extractTextInPage() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const main = document.querySelector('main') || document.body;
  const parts = [...main.querySelectorAll('h1,h2,h3,p,li')]
    .filter((el) => !el.closest('nav, header, footer'))
    .map((el) => clean(el.innerText)).filter((t) => t.length > 20);
  return [...new Set(parts)].join('\n').slice(0, 2500);
}
