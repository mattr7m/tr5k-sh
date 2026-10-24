# tr5k.sh

Personal technical blog and notebook by Matt Rennebohm ([@mattr7m](https://github.com/mattr7m)).

A content-first site for how-tos, technical articles, and project logs — styled to feel like a well-used developer's notebook.

---

## Project Status

This project is in the **design/scaffolding phase**. The site design has been prototyped as static HTML/CSS. The next major milestone is wiring up a content pipeline from an Obsidian vault so that Markdown files can be published to the site through a GitHub PR review workflow.

### What exists

- `site/index.html` — **v3 (current)**: Simplified single-column layout, all ruled notebook paper, horizontal tag chips, title in topbar. This is the version to build from.
- `site/v1-sidebar-layout.html` — v1: Left sidebar TOC, site title below topbar. Archived for reference.
- `site/v2-per-section-textures.html` — v2: Per-section paper textures (grid paper for Hacking, terminal for Infra, ruled for Personal). Archived for potential future use.
- `content/` — Placeholder directory for Obsidian-sourced Markdown content.

### What needs to be built

See [Content Pipeline](#content-pipeline-obsidian--github--site) and [Open Tasks](#open-tasks) below.

---

## Design

### Aesthetic

"Yellowed brown notebook" — the look of a developer's well-used field notebook. The design uses subtle depth (soft shadows, inset code blocks, layered page-edge shadows) to make elements feel tangible without crossing into skeuomorphism.

### Key design elements

- **Paper texture**: Ruled notebook lines via CSS `repeating-linear-gradient`, faint red margin line, SVG noise grain on the body background.
- **Page card**: Content sits on a raised "page" with multi-layer `box-shadow` simulating stacked paper edges.
- **Code blocks**: Dark terminal-style (`#2e2820`) with `inset` box-shadow to feel pressed into the page.
- **Callouts**: Inset background with left accent border — used for notes, warnings, lessons learned.
- **Typography**: `Source Serif 4` for body/headings (comfortable for long reading), `IBM Plex Mono` for all UI/nav/code/metadata (technical credibility).
- **Color palette**: Defined as CSS custom properties in `:root` — warm browns, saddlebrown accent (`#8b4513`), terminal green (`#8fae6e`).

### Navigation structure

```
┌──────────────────────────────────────────────────────────┐
│  tr5k.sh   $ ~/Personal/camping█    About Infra Hacking Reading Personal │
├──────────────────────────────────────────────────────────┤
│  [camping] [woodworking] [photography] [reads & reviews] │  ← tag chips
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Article Title                                          │
│   Feb 18, 2026  camping  infra                           │
│                                                          │
│   Content...                                             │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

- **Topbar (dark, sticky)**: Site title (left, green), terminal-style breadcrumb (left, after title), section nav links (right-justified).
- **Tag chips**: Horizontal row above content, replaces sidebar TOC. Acts as sub-section filter within each top-level section.
- **Breadcrumb**: Updates dynamically to reflect current section + active tag (e.g., `~/Hacking/exploits`).
- **Content width**: Constrained to `720px` for comfortable reading and clean mobile collapse.

### Archived design directions

**v2 per-section textures** are shelved but preserved. The idea: Hacking gets engineering grid paper, Infra gets a dark terminal aesthetic (scanlines, CRT vignette, traffic-light title bar dots), Personal keeps ruled notebook. These could be revisited later as the site matures.

---

## Content Pipeline: Obsidian → GitHub → Site

### Overview

Matt writes in an Obsidian vault synced across devices via **Obsidian Sync**. When content is ready to publish, it gets pushed to a branch in this GitHub repo, reviewed via PR (with automated linting/spellcheck), and merged to deploy.

### Architecture

```
┌─────────────┐    Obsidian Sync     ┌─────────────┐
│  Obsidian   │◄────────────────────►│  Obsidian   │
│  (desktop)  │   (cross-device)     │  (mobile)   │
└──────┬──────┘                      └─────────────┘
       │
       │  Obsidian Git plugin
       │  (desktop only, manual trigger)
       │
       ▼
┌──────────────────────────────────────────────────┐
│  GitHub: mattr7m/tr5k.sh                         │
│                                                  │
│  feature branch ──► PR ──► main                  │
│       │                      │                   │
│       │  CI checks:          │  Deploy:          │
│       │  - markdownlint      │  - GitHub Pages   │
│       │  - spellcheck        │    or static host │
│       │  - link checker      │                   │
│       │                      │                   │
└──────────────────────────────────────────────────┘
```

### Obsidian + Git setup (with Obsidian Sync coexistence)

The key challenge is running Obsidian Sync and Git simultaneously without conflicts. The solution is **storing the `.git` directory outside the vault** so Obsidian Sync never sees it.

#### Initial setup

```bash
# From the root of the Obsidian vault:
git init --separate-git-dir ~/path/outside/vault/.git-tr5k

# This creates a .git FILE (not directory) in the vault root
# containing a pointer like: gitdir: /Users/matt/path/outside/vault/.git-tr5k
# Add .git to Obsidian Sync's ignore list if needed.

git remote add origin git@github.com:mattr7m/tr5k.sh.git
git branch -M main
```

#### Obsidian Git plugin configuration

Install the [Obsidian Git plugin](https://github.com/Vinzent03/obsidian-git) (community plugin by Vinzent03).

In plugin settings, set the `GIT_DIR` environment variable:

```
Additional environment variables:
GIT_DIR=/Users/matt/path/outside/vault/.git-tr5k
```

Key settings:
- **Disable auto commit/push** — publishing should be intentional, not automatic.
- **Disable auto pull** — this repo is for publishing, not vault sync.
- **Pull updates on startup**: Off (Obsidian Sync handles cross-device sync).

#### Publishing workflow

1. Write/edit content in Obsidian normally (Obsidian Sync handles cross-device).
2. When ready to publish, open the command palette (`Cmd+P`):
   - `Obsidian Git: Create new branch` → name it (e.g., `post/lora-backcountry`)
   - Stage the specific files to publish via the Source Control View
   - `Obsidian Git: Commit` → `Obsidian Git: Push`
3. Open GitHub, create a PR from the branch.
4. CI runs spellcheck + markdownlint. Fix any issues.
5. If edits are made on the branch (via GitHub web editor or locally): `Obsidian Git: Pull` to bring changes back to vault.
6. Merge PR → content is live.

#### Important notes

- **Desktop only for Git operations.** The Obsidian Git plugin on mobile uses isomorphic-git (a JS reimplementation) which is unstable and limited. Keep Git publishing to desktop.
- **Git is for publishing, Obsidian Sync is for sync.** Don't use Git as a sync mechanism. The two systems serve different purposes and should not overlap.
- **`.gitignore` should exclude vault internals.** Only content meant for the site should be tracked:

```gitignore
# Vault internals — Obsidian Sync handles these
.obsidian/
.trash/
.DS_Store

# Only track publishable content
# (adjust paths to match vault structure)
!content/
!site/
!.github/
!README.md
```

### GitHub Actions: PR quality checks

#### Markdown linting (`.github/workflows/lint.yml`)

```yaml
name: Lint

on:
  pull_request:
    paths:
      - '**.md'

jobs:
  markdownlint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: DavidAnson/markdownlint-cli2-action@v22
        with:
          globs: 'content/**/*.md'
```

Configure rules in `.markdownlint.jsonc`:

```jsonc
{
  "MD013": false,           // disable line length (Obsidian wraps naturally)
  "MD033": false,           // allow inline HTML (needed for some embeds)
  "MD041": false            // don't require first line to be h1
}
```

#### Spellcheck (`.github/workflows/spellcheck.yml`)

```yaml
name: Spellcheck

on:
  pull_request:
    paths:
      - '**.md'

jobs:
  check-spelling:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: rojopolis/spellcheck-github-actions@0.40.0
        with:
          config_path: .spellcheck.yml
          task_name: Markdown
```

Configure in `.spellcheck.yml`:

```yaml
matrix:
  - name: Markdown
    aspell:
      lang: en
    dictionary:
      wordlists:
        - .wordlist.txt
    pipeline:
      - pyspelling.filters.markdown:
      - pyspelling.filters.html:
          comments: false
          ignores:
            - code
            - pre
    sources:
      - 'content/**/*.md'
    default_encoding: utf-8
```

Maintain a `.wordlist.txt` for technical terms, project names, etc.:

```
Obsidian
NixOS
Meshtastic
LoRa
Heltec
homelab
LiFePO4
WireGuard
Tailscale
ZFS
k3s
tr5k
```

---

## Markdown → HTML Rendering

### The problem

The site is static HTML/CSS. Content lives as Markdown files in the Obsidian vault. We need a way to embed rendered Markdown into the site's HTML page template.

### Requirements

- Convert Obsidian-flavored Markdown to HTML fragments.
- Inject those fragments into the `page-card` content area of the site template.
- Handle Obsidian-specific syntax: `[[wikilinks]]`, `![[embedded images]]`, callouts (`> [!note]`), and code blocks with syntax highlighting.
- Output must be static HTML (no client-side Markdown rendering in the browser).
- The build step should run in CI (GitHub Actions) on merge to `main`.

### Recommended approach: Build script with markdown-it

Use a Node.js build script that:

1. Reads Markdown files from `content/`.
2. Parses front matter (YAML) for metadata (title, date, section, tags).
3. Converts Markdown to HTML using [markdown-it](https://github.com/markdown-it/markdown-it) with plugins:
   - `markdown-it-obsidian` or custom plugin for `[[wikilinks]]`
   - `markdown-it-highlightjs` for syntax-highlighted code blocks
   - Custom plugin for Obsidian callout syntax (`> [!note]`, `> [!warning]`, etc.)
4. Injects the HTML fragment into the page template (the `page-card` div).
5. Generates an `index.html` with the article list for each section.
6. Outputs to a `dist/` directory for deployment.

### Expected front matter format

```yaml
---
title: "Backcountry Network Monitoring with LoRa"
date: 2026-02-18
section: personal
tags: [camping, infra]
draft: false
---
```

### Obsidian syntax to handle

| Obsidian syntax | Target HTML |
|----------------|-------------|
| `[[Other Note]]` | `<a href="/section/other-note">Other Note</a>` |
| `![[image.png]]` | `<img src="/assets/image.png" alt="image">` |
| `> [!note] Title` | `<div class="callout"><div class="callout-label">Note</div>...` |
| `` ```lang ... ``` `` | `<pre><code class="language-lang">...</code></pre>` (highlighted) |
| `==highlight==` | `<mark>highlight</mark>` |

### Alternative approaches considered

- **Hugo / Eleventy / Astro** — Full static site generators. More batteries-included but heavier. Worth considering if the custom build script grows too complex. Hugo has the best Markdown rendering out of the box. Eleventy is the most flexible with templates.
- **Pandoc** — CLI tool, great for one-off conversion but harder to integrate with a custom template system.
- **Client-side rendering (marked.js / showdown)** — Render Markdown in the browser. Simpler build, but bad for SEO, slower initial paint, and doesn't match the "static HTML" goal.

### Build + deploy pipeline

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build    # runs the build script
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist/

  deploy:
    needs: build
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

## Project Structure

```
tr5k.sh/
├── README.md                   # This file
├── .github/
│   └── workflows/
│       ├── lint.yml            # PR: markdownlint
│       ├── spellcheck.yml      # PR: spellcheck
│       └── deploy.yml          # main: build + deploy
├── .gitignore
├── .markdownlint.jsonc         # markdownlint config
├── .spellcheck.yml             # PySpelling config
├── .wordlist.txt               # Custom dictionary
├── content/                    # Markdown source (from Obsidian vault)
│   ├── personal/
│   │   └── camping/
│   │       └── lora-backcountry.md
│   ├── infra/
│   │   └── homelab/
│   │       └── nixos-migration.md
│   ├── hacking/
│   │   └── exploits/
│   │       └── http2-rate-limits.md
│   └── reading/
│       └── technical/
├── site/
│   ├── index.html              # v3 — current design (build template source)
│   ├── v1-sidebar-layout.html  # archived
│   └── v2-per-section-textures.html  # archived
├── build/                      # Build script(s) — TO BE CREATED
│   └── build.js
├── dist/                       # Generated output (gitignored)
└── package.json                # TO BE CREATED
```

---

## Open Tasks

Ordered roughly by priority:

### 1. Build script: Markdown → HTML
- [ ] Create `build/build.js` (or choose a static site generator).
- [ ] Parse Obsidian-flavored Markdown with front matter.
- [ ] Handle wikilinks, image embeds, callouts, code highlighting.
- [ ] Inject rendered HTML into the `page-card` template from `site/index.html`.
- [ ] Generate section index pages with article lists.
- [ ] Generate tag-filtered views.

### 2. Content structure
- [ ] Define front matter schema (title, date, section, tags, draft).
- [ ] Create sample content files in `content/` mirroring the dummy articles in the HTML mockup.
- [ ] Decide on image/asset handling (co-located with posts? central `assets/` dir?).

### 3. GitHub Actions
- [ ] Finalize and test `lint.yml` workflow.
- [ ] Finalize and test `spellcheck.yml` workflow.
- [ ] Create `deploy.yml` for build + GitHub Pages deployment.
- [ ] Add link checker (e.g., `lycheeverse/lychee-action`) to PR checks.

### 4. Obsidian Git integration
- [ ] Set up `--separate-git-dir` on the vault.
- [ ] Install and configure Obsidian Git plugin.
- [ ] Test the branch → PR → merge → pull-back workflow end to end.
- [ ] Document any vault-specific `.gitignore` adjustments.

### 5. Domain + hosting
- [ ] Acquire `tr5k.sh` domain (if not already owned).
- [ ] Configure DNS for GitHub Pages (or alternative static host).
- [ ] Set up HTTPS.

### 6. Design refinements
- [ ] Dark mode toggle (the notebook aesthetic could invert nicely — dark paper, light ruled lines).
- [ ] RSS feed generation in the build script.
- [ ] `About` page content.
- [ ] Revisit per-section paper textures from v2 once content pipeline is working.
- [ ] Mobile hamburger menu for section nav (currently just wraps, works but could be cleaner).
- [ ] Search (lightweight client-side, e.g., Pagefind or Lunr).

---

## Design Decisions Log

| Decision | Chosen | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| Domain | `tr5k.sh` | `tr5k.dev`, `mattr7m.dev` | `.sh` has more personality, evokes terminal/CLI, less saturated than `.dev`. Short + memorable. |
| GitHub handle | `mattr7m` | matching `tr5k` | Keep handles separate — blog brand ≠ personal identity. Linked via site footer. |
| Site framework | Vanilla HTML/CSS + build script | Hugo, Eleventy, Astro | Start simple. Upgrade later if needed. The design is specific enough that a custom build gives more control. |
| Sync | Obsidian Sync (devices) + Git (publishing) | Git-only, Syncthing | Obsidian Sync is reliable for cross-device. Git is for the publishing pipeline only. Separate concerns. |
| Git coexistence | `--separate-git-dir` | `.gitignore` only, separate publish folder | Cleanest separation. Obsidian Sync never sees `.git` internals. |
| Markdown renderer | markdown-it (proposed) | Hugo, Pandoc, client-side | Lightweight, pluggable, handles Obsidian syntax with plugins. Runs in Node.js (same as potential build tooling). |
