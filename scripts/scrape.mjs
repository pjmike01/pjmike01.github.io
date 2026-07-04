// 一次性迁移脚本：抓取 pjmike.github.io（Hexo）全部文章转为本地 Markdown。
// 文章图床（腾讯 COS）已失效，图片按 Wayback Machine 存档清单尽量恢复。
// 用法：node scripts/scrape.mjs
import TurndownService from 'turndown';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const SITE = 'https://pjmike.github.io';
const COS_HOST = 'pjmike-1253796536.cos.ap-beijing.myqcloud.com';
const POSTS_DIR = 'content/posts';
const IMG_DIR = 'images/posts';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {}
    await sleep(1000 * (i + 1));
  }
  return null;
}

async function fetchBinary(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60000) });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      if (res.status === 404) return null;
    } catch {}
    await sleep(1500 * (i + 1));
  }
  return null;
}

// ---- 1. 收集全部文章 URL（归档共 8 页） ----
async function collectPostUrls() {
  const urls = new Set();
  for (let p = 1; p <= 8; p++) {
    const pageUrl = p === 1 ? `${SITE}/archives/` : `${SITE}/archives/page/${p}/`;
    const html = await fetchText(pageUrl);
    if (!html) throw new Error(`归档页抓取失败: ${pageUrl}`);
    for (const m of html.matchAll(/href="(\/20\d{2}\/\d{2}\/\d{2}\/[^"]+\/)"/g)) {
      urls.add(SITE + m[1]);
    }
  }
  return [...urls];
}

// ---- 2. Wayback 存档清单（只对有存档的图片发起下载） ----
const normalize = (u) => {
  try { return decodeURIComponent(u).toLowerCase(); } catch { return u.toLowerCase(); }
};

async function fetchArchivedImageSet() {
  const text = await fetchText(
    `https://web.archive.org/cdx/search/cdx?url=${COS_HOST}*&collapse=urlkey&filter=statuscode:200&fl=original`
  );
  const set = new Set();
  if (text) for (const line of text.split('\n')) {
    if (line.trim()) set.add(normalize(line.trim()));
  }
  return set;
}

// ---- 3. HTML 预处理与解析 ----
const decodeEntities = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
   .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

// Hexo 代码块（figure.highlight 内含行号表格）还原为 <pre><code>
function flattenHighlightFigures(html) {
  return html.replace(
    /<figure class="highlight ([^"]*)">[\s\S]*?<td class="code"><pre>([\s\S]*?)<\/pre><\/td>[\s\S]*?<\/figure>/g,
    (_, lang, codeHtml) => {
      const code = codeHtml
        .replace(/<br\s*\/?>/g, '\n')
        .replace(/<[^>]+>/g, '');
      const language = lang.trim() === 'plain' ? '' : lang.trim();
      return `<pre><code class="language-${language}">${code}</code></pre>`;
    }
  );
}

function extractBetween(html, startMark, endMark) {
  const start = html.indexOf(startMark);
  if (start === -1) return null;
  const end = html.indexOf(endMark, start);
  return html.slice(start, end === -1 ? undefined : end);
}

// ---- 4. 图片本地化 ----
async function localizeImages(entryHtml, slug, archivedSet, report) {
  const lost = [];
  const srcs = [...entryHtml.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  let idx = 0;
  for (const src of new Set(srcs)) {
    idx++;
    const abs = src.startsWith('http') ? src : SITE + src;
    let basename = path.basename(new URL(abs).pathname);
    try { basename = decodeURIComponent(basename); } catch {}
    basename = basename.replace(/[^\w.一-鿿-]/g, '_') || `img-${idx}`;
    const localRel = `${IMG_DIR}/${slug}/${idx}-${basename}`;

    let buf = null;
    if (existsSync(localRel)) {
      // 断点续传：已下载过的图片直接复用
      entryHtml = entryHtml.replaceAll(`src="${src}"`, `src="/${localRel}"`);
      report.recovered.push(abs);
      continue;
    }
    if (abs.includes(COS_HOST)) {
      if (archivedSet.has(normalize(abs))) {
        buf = await fetchBinary(`https://web.archive.org/web/2020im_/${abs}`);
        await sleep(800); // Wayback 限速
      }
    } else {
      buf = await fetchBinary(abs);
      if (!buf) {
        buf = await fetchBinary(`https://web.archive.org/web/2020im_/${abs}`);
        await sleep(800);
      }
    }

    if (buf) {
      await mkdir(path.join(IMG_DIR, slug), { recursive: true });
      await writeFile(localRel, buf);
      entryHtml = entryHtml.replaceAll(`src="${src}"`, `src="/${localRel}"`);
      report.recovered.push(abs);
    } else {
      lost.push(abs);
      report.lost.push(abs);
      entryHtml = entryHtml.replace(
        new RegExp(`<img[^>]+src="${src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>`, 'g'),
        `<p><em>[配图已丢失: ${basename}]</em></p>`
      );
    }
  }
  return { entryHtml, lost };
}

// ---- 5. 单篇文章处理 ----
const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

async function scrapePost(url, archivedSet, report) {
  const html = await fetchText(url);
  if (!html) throw new Error(`抓取失败: ${url}`);

  const [, y, m, d, rawSlug] = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\/([^/]+)\/$/);
  const slug = decodeURIComponent(rawSlug);
  const date = `${y}-${m}-${d}`;

  const titleMatch = html.match(/<h1[^>]*class="article-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/);
  const title = decodeEntities((titleMatch ? titleMatch[1] : slug).replace(/<[^>]+>/g, '').trim());

  let entry = extractBetween(html, '<div class="article-entry', '<footer class="article-footer');
  if (!entry) throw new Error(`未找到正文: ${url}`);

  // 文章 tags 在 <div class="article-tag"> 内（tag-link），不在 footer
  const tagBlock = extractBetween(html, '<div class="article-tag">', '</div>') || '';
  const tags = [...tagBlock.matchAll(/class="tag-link"[^>]*>([^<]+)</g)].map((m) => m[1].trim());

  entry = entry.replace(/<a[^>]*headerlink[^>]*>\s*<\/a>/g, ''); // 去掉 Hexo 标题锚点
  entry = flattenHighlightFigures(entry);
  const { entryHtml, lost } = await localizeImages(entry, slug, archivedSet, report);

  const markdown = td.turndown(entryHtml);
  const fm = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `date: ${date}`,
    `slug: "${slug}"`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    ...(lost.length ? [`lost_images:`, ...lost.map((u) => `  - "${u}"`)] : []),
    '---',
    '',
  ].join('\n');

  const file = path.join(POSTS_DIR, `${date}-${slug}.md`);
  await writeFile(file, fm + markdown + '\n');
  return { url, file, title, images: { lost: lost.length } };
}

// ---- main ----
const report = { ok: [], failed: [], recovered: [], lost: [] };
await mkdir(POSTS_DIR, { recursive: true });
await mkdir(IMG_DIR, { recursive: true });

console.log('收集文章 URL…');
const urls = await collectPostUrls();
console.log(`共 ${urls.length} 篇`);

console.log('获取 Wayback 图片存档清单…');
const archivedSet = await fetchArchivedImageSet();
console.log(`存档图片 ${archivedSet.size} 张`);

let n = 0;
for (const url of urls) {
  n++;
  try {
    const r = await scrapePost(url, archivedSet, report);
    report.ok.push(r);
    console.log(`[${n}/${urls.length}] OK ${r.title}${r.images.lost ? `（丢图 ${r.images.lost}）` : ''}`);
  } catch (e) {
    report.failed.push({ url, error: String(e) });
    console.error(`[${n}/${urls.length}] FAIL ${url}: ${e.message}`);
  }
  await sleep(200);
}

console.log('\n===== 抓取报告 =====');
console.log(`成功: ${report.ok.length} / ${urls.length}`);
console.log(`失败: ${report.failed.length}`);
console.log(`图片恢复: ${report.recovered.length} 张，丢失: ${report.lost.length} 张`);
if (report.failed.length) console.log('失败列表:', report.failed);
await writeFile('scrape-report.json', JSON.stringify(report, null, 2));
console.log('明细已写入 scrape-report.json');
