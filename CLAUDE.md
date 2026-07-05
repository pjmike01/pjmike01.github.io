# pjmike 个人站点

pjmike 的个人网站：博客（迁移自已下线的 pjmike.github.io Hexo 博客）+ 摄影图库。
纯静态站点，无框架，Node 脚本构建，部署在 GitHub Pages（https://pjmike01.github.io/）。

## 目录约定

```
content/posts/*.md   # 博客文章（Markdown + front matter: title/date/tags/lost_images）
content/about.md     # 关于我
scripts/scrape.mjs   # 一次性迁移抓取脚本（保留备查，日常不运行）
scripts/build.mjs    # 构建脚本，唯一构建入口
templates/           # HTML 模板（首页/文章/图库/about 共用头尾）
images/<主题>/       # 摄影作品原图，按主题分目录：日落晚霞 / 湖光山色 / 城市与桥 / 花鸟
images/posts/        # 文章配图（从 Wayback 恢复），不进图库
images/个人介绍/     # 个人头像等站点素材，不进图库
dist/                # 构建输出，git 忽略，不手改
```

## 命名与内容规则

- 文章文件名：`YYYY-MM-DD-slug.md`，slug 沿用旧站 URL 中的标题段（可含中文），保证新旧链接可对照
- front matter 必含 `title`、`date`；`lost_images` 记录未能恢复的图片原始 URL
- 新照片放进 `images/<主题>/` 对应分类子目录（文件名仍为「地点+主题.jpg」中文命名），构建脚本按分类分节渲染图库页；新增主题分类需同步改 `scripts/build.mjs` 中的 `GALLERY_CATEGORIES` 顺序表

## 构建与验证

```bash
npm install              # 首次；devDeps 仅 turndown(抓取用)、marked(构建用)
node scripts/build.mjs   # 构建到 dist/
npx serve dist           # 本地预览
```

改动模板/脚本/内容后必须跑 `node scripts/build.mjs` 确认无报错，再抽查受影响页面。

## 设计约定

- 风格参考 tw93.fun：极简、窄内容列（~700px）、大量留白、暗色模式（prefers-color-scheme）
- SVG 动效全部手写内联，不引入 JS 动画库
- 正文字体用系统栈（-apple-system, PingFang SC），不加载 webfont
- 不引入运行时框架和 highlight.js，代码块高亮用纯 CSS

## 红线

- 部署到 Cloudflare（或任何公开发布）必须先单独征得确认
- 不删除 `content/posts/` 下的文章文件（这是旧博客唯一备份）
- 不删除 `images/` 下的照片原图

## 部署（GitHub Pages）

- 仓库：pjmike01/pjmike01.github.io，Pages 源为 GitHub Actions
- 工作流：`.github/workflows/deploy.yml`，push main 自动触发（也可手动 Run workflow），CI 内跑 `npm ci` + `node scripts/build.mjs` 后发布 `dist/`
- 无环境变量、无框架预设
- 注意：Pages 源必须保持「GitHub Actions」，若切回 Deploy from a branch 会退回 Jekyll 渲染 README 的旧页面
