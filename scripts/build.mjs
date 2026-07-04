// 构建脚本：content/ + images/ + templates/ → dist/
// 用法：node scripts/build.mjs
import { marked } from 'marked';
import { mkdir, readdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import path from 'node:path';

const DIST = 'dist';
const base = await readFile('templates/base.html', 'utf8');
const css = await readFile('templates/style.css', 'utf8');
const siteJs = await readFile('templates/site.js', 'utf8');

marked.setOptions({ gfm: true });

function parseFrontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  let lastKey = null;
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w[\w_]*):\s*(.*)$/);
    if (kv) {
      lastKey = kv[1];
      let v = kv[2].trim();
      if (v.startsWith('[')) {
        meta[lastKey] = [...v.matchAll(/"([^"]*)"/g)].map((x) => x[1]);
      } else {
        meta[lastKey] = v.replace(/^"|"$/g, '');
      }
    } else if (line.match(/^\s+-\s+/) && lastKey) {
      if (!Array.isArray(meta[lastKey]) || typeof meta[lastKey] === 'string') meta[lastKey] = [];
      meta[lastKey].push(line.replace(/^\s+-\s+/, '').replace(/^"|"$/g, ''));
    }
  }
  return { meta, body: raw.slice(m[0].length) };
}

function page({ title, nav, content }) {
  return base
    .replaceAll('{{title}}', title)
    .replaceAll('{{content}}', content)
    .replace(new RegExp(`(data-nav="${nav}")`), '$1 class="active"');
}

async function writePage(rel, html) {
  const file = path.join(DIST, rel);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, html);
}

// ---- 读取文章 ----
const posts = [];
for (const f of (await readdir('content/posts')).filter((f) => f.endsWith('.md')).sort().reverse()) {
  const raw = await readFile(path.join('content/posts', f), 'utf8');
  const { meta, body } = parseFrontMatter(raw);
  posts.push({
    title: meta.title || f,
    date: meta.date,
    slug: meta.slug || f.replace(/\.md$/, ''),
    tags: meta.tags || [],
    html: marked.parse(body),
  });
}
posts.sort((a, b) => b.date.localeCompare(a.date));

// ---- 清理并准备 dist ----
await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });
await cp('images', path.join(DIST, 'images'), {
  recursive: true,
  filter: (src) => !src.includes('.DS_Store'),
});
await writeFile(path.join(DIST, 'style.css'), css);
await writeFile(path.join(DIST, 'site.js'), siteJs);

// ---- 首页：hero + 按年份分组的文章列表 ----
const hero = await readFile('templates/hero.svg', 'utf8');
const byYear = new Map();
for (const p of posts) {
  const y = p.date.slice(0, 4);
  if (!byYear.has(y)) byYear.set(y, []);
  byYear.get(y).push(p);
}
let listHtml = '';
for (const [year, items] of byYear) {
  listHtml += `<section class="year-group"><h2 class="year">${year}</h2><ul class="post-list">`;
  for (const p of items) {
    listHtml += `<li><time>${p.date.slice(5)}</time><a href="/posts/${encodeURIComponent(p.slug)}/">${p.title}</a></li>`;
  }
  listHtml += `</ul></section>`;
}
await writePage(
  'index.html',
  page({
    title: 'pjmike',
    nav: 'home',
    content: `<div class="hero">${hero}<p class="tagline">Java 后端开发 · 努力做一个笔耕者 · 业余摄影</p></div>${listHtml}`,
  })
);

// ---- 文章页 ----
for (const p of posts) {
  const tags = p.tags.map((t) => `<span class="tag">${t}</span>`).join('');
  await writePage(
    path.join('posts', p.slug, 'index.html'),
    page({
      title: `${p.title} · pjmike`,
      nav: 'home',
      content: `<article class="post"><header><h1>${p.title}</h1><p class="post-meta"><time>${p.date}</time>${tags}</p></header>${p.html}</article><p class="back"><a href="/">← 返回首页</a></p>`,
    })
  );
}

// ---- 图库页 ----
const photos = (await readdir('images'))
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'zh'));
const galleryHtml = photos
  .map((f) => {
    const caption = f.replace(/\.[^.]+$/, '').replace(/_/g, ' · ');
    return `<figure class="photo"><img loading="lazy" src="/images/${encodeURIComponent(f)}" alt="${caption}"><figcaption>${caption}</figcaption></figure>`;
  })
  .join('\n');
const aperture = await readFile('templates/aperture.svg', 'utf8');
await writePage(
  'gallery/index.html',
  page({
    title: '图库 · pjmike',
    nav: 'gallery',
    content: `<div class="gallery-head">${aperture}<h1>图库</h1><p class="gallery-sub">杭州 · 日落与湖山</p></div><div class="gallery">${galleryHtml}</div><div id="lightbox" hidden><img alt=""><figcaption></figcaption></div>`,
  })
);

// ---- 关于页 ----
const aboutRaw = await readFile('content/about.md', 'utf8');
const about = parseFrontMatter(aboutRaw);
await writePage(
  'about/index.html',
  page({
    title: '关于 · pjmike',
    nav: 'about',
    content: `<article class="post about-page">${marked.parse(about.body)}</article>`,
  })
);

console.log(`构建完成：文章 ${posts.length} 篇，照片 ${photos.length} 张 → ${DIST}/`);
