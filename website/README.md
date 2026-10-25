# GROOT website

Marketing site and user docs for GROOT. Facts on this site come from the
desktop app repository: `package.json` (v1.0.4, Apache-2.0, Node 22+), the
root README, `docs/spaces.md`, and `docs/obsidian-plugin-compatibility.md`.
The hero graph is built from real notes and `[[wiki links]]` in `OO-Test-Vault`.

## Run

```bash
cd website
npm install
npm run dev
```

Dev server: `http://localhost:4173`

```bash
npm run build
npm run preview
```

## Vercel

Set **Root Directory** to `website`. Use Node 22. The production build runs
`prebuild`, which installs the desktop app's production dependencies from the
repo root. The hero editor and graph import those packages from `../src`.

Do not set the project root to the repository root unless you also change the
install command to `npm install && cd website && npm install` and the output
directory to `website/dist`.

## DigitalOcean App Platform

Create a **Static Site** from the repository that contains GROOT. Set the
source directory to `website`, use Node.js 22 or newer, run
`npm ci && npm run build`, and set the output directory to `dist`. Set the
catchall document to `index.html` so direct links to the site's React routes
work. The build installs the root app dependencies used by the site's embedded
editor demo.

This publishes the marketing site and documentation. GROOT itself remains a
desktop app installed on each user's machine; DigitalOcean does not run its
Electron process or store its vault. Publish desktop installers separately
as downloadable release files, for example in DigitalOcean Spaces.

The desktop app's Supabase URL and publishable key stay in its local
configuration. Supabase continues to provide authentication, spaces, database
sync, and realtime collaboration. Do not add a DigitalOcean database or put a
Supabase service-role key in this static site's build settings.
