// Obsidian-flavoured Markdown → HTML, scoped to ONE site.
//
// The site boundary is enforced here for everything a note can point at:
//  - [[wikilinks]] resolve only to notes in this site; anything else renders as
//    plain text (the author's own words — no href, no slug, no existence hint).
//  - ![[embeds]] / relative images are copied into this site only when this
//    site's own notes reference them, so a private image never reaches public.

import path from 'node:path';
import MarkdownIt from 'markdown-it';
import markPlugin from 'markdown-it-mark';
import hljs from 'highlight.js';
import { slugify } from './contract.js';

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.avif']);

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function assetUrl(file) {
  return `/assets/${encodeURIComponent(path.basename(file))}`;
}

// ctx: { notesByName: Map(lower basename → note), assets: Map(lower basename → path),
//        usedAssets: Set(path), warn(msg) }
export function createRenderer(ctx) {
  const md = new MarkdownIt({
    html: true,          // author-controlled content; the mock allowed inline HTML
    linkify: true,
    typographer: true,
    highlight(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try { return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value; } catch { /* fall through */ }
      }
      return ''; // markdown-it escapes + wraps in <pre><code class="language-x">
    },
  });
  md.use(markPlugin);

  // ── [[wikilinks]] and ![[embeds]] ────────────────────────────────────────
  md.inline.ruler.before('link', 'obsidian_link', (state, silent) => {
    const src = state.src;
    let pos = state.pos;
    const embed = src.charCodeAt(pos) === 0x21 /* ! */;
    if (embed) pos += 1;
    if (src.slice(pos, pos + 2) !== '[[') return false;
    const end = src.indexOf(']]', pos + 2);
    if (end < 0) return false;
    const inner = src.slice(pos + 2, end);
    if (inner.includes('\n') || inner.trim() === '') return false;
    if (!silent) {
      const token = state.push('obsidian_link', '', 0);
      token.meta = { embed, inner };
    }
    state.pos = end + 2;
    return true;
  });

  md.renderer.rules.obsidian_link = (tokens, idx) => {
    const { embed, inner } = tokens[idx].meta;
    const [targetRaw, aliasRaw] = inner.split('|');
    const [nameRaw, heading] = targetRaw.split('#');
    const name = nameRaw.trim();
    const alias = aliasRaw?.trim();
    const ext = path.extname(name).toLowerCase();

    // Attachment (embed or plain link to a non-note file).
    if (ext && ext !== '.md') {
      const file = ctx.assets.get(path.basename(name).toLowerCase());
      if (!file) {
        ctx.warn(`missing attachment "${name}"`);
        return escapeHtml(alias || name);
      }
      ctx.usedAssets.add(file);
      if (embed && IMAGE_EXT.has(ext)) {
        const width = alias && /^\d+(x\d+)?$/.test(alias) ? ` width="${alias.split('x')[0]}"` : '';
        const alt = alias && !width ? alias : path.basename(name, ext);
        return `<img src="${assetUrl(file)}" alt="${escapeHtml(alt)}"${width}>`;
      }
      return `<a href="${assetUrl(file)}">${escapeHtml(alias || path.basename(name))}</a>`;
    }

    // Note link (note transclusion isn't supported — rendered as a link).
    const note = ctx.notesByName.get(path.basename(name, '.md').toLowerCase());
    const text = alias || (heading && !name ? heading : name) || heading || '';
    if (!note) return escapeHtml(text); // outside this site: plain text, no href
    const hash = heading ? `#${slugify(heading)}` : '';
    return `<a href="/posts/${note.slug}/${hash}">${escapeHtml(alias || note.title)}</a>`;
  };

  // ── Callouts: > [!note] Optional title ───────────────────────────────────
  // Runs after block parsing, before inline parsing, so the marker can be
  // stripped from the paragraph's raw content.
  md.core.ruler.after('block', 'obsidian_callout', (state) => {
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'blockquote_open') continue;
      const inline = t[i + 2];
      if (t[i + 1]?.type !== 'paragraph_open' || inline?.type !== 'inline') continue;
      const m = /^\[!([A-Za-z]+)\][+-]?[ \t]*(.*)$/m.exec(inline.content.split('\n')[0]);
      if (!m) continue;
      const kind = m[1].toLowerCase();
      const label = m[2].trim() || kind.charAt(0).toUpperCase() + kind.slice(1);
      inline.content = inline.content.split('\n').slice(1).join('\n');
      let depth = 0; let close = -1;
      for (let j = i; j < t.length; j++) {
        if (t[j].type === 'blockquote_open') depth++;
        if (t[j].type === 'blockquote_close' && --depth === 0) { close = j; break; }
      }
      if (close < 0) continue;
      const open = new state.Token('html_block', '', 0);
      open.content = `<div class="callout callout-${escapeHtml(kind)}"><div class="callout-label">${escapeHtml(label)}</div>\n`;
      const shut = new state.Token('html_block', '', 0);
      shut.content = '</div>\n';
      t[close] = shut;
      t[i] = open;
      if (inline.content.trim() === '') t.splice(i + 1, 3); // marker-only first paragraph
    }
  });

  // ── Heading ids, so [[Note#Heading]] anchors land ────────────────────────
  md.core.ruler.push('heading_ids', (state) => {
    const seen = new Map();
    const t = state.tokens;
    for (let i = 0; i < t.length; i++) {
      if (t[i].type !== 'heading_open') continue;
      const base = slugify(t[i + 1]?.content || '') || 'section';
      const n = seen.get(base) || 0;
      seen.set(base, n + 1);
      t[i].attrSet('id', n ? `${base}-${n}` : base);
    }
  });

  // ── Standard Markdown images with vault-relative paths ───────────────────
  const defaultImage = md.renderer.rules.image;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src') || '';
    if (src && !/^([a-z]+:)?\/\//i.test(src) && !src.startsWith('data:')) {
      const file = ctx.assets.get(path.basename(decodeURIComponent(src)).toLowerCase());
      if (file) { ctx.usedAssets.add(file); token.attrSet('src', assetUrl(file)); }
      else { ctx.warn(`missing image "${src}"`); return escapeHtml(token.content || src); }
    }
    return defaultImage(tokens, idx, options, env, self);
  };

  return (markdown) => md.render(markdown);
}
