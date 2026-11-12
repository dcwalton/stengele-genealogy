# Genealogy

An Angular genealogy app built on [Topola](https://github.com/PeWu/topola). It renders a
horizontal ancestor chart — the starting person on the left, ancestors extending backward in
time to the right — with click-to-edit person details. Edits are persisted server-side in
`server-data/genealogy.json` and shared by all users.

## Running

Two processes are needed:

```bash
# 1. API + static file server (port 3000), serves the built app from dist/
npm run server

# 2. Angular dev server (port 4200), proxies /api to the backend
npm start
```

Then open http://localhost:4200. To run the production build instead of the dev server:

```bash
ng build
npm run server   # serves dist/genealogy/browser on http://localhost:3000
```

If the backend is not running, the app falls back to the embedded sample GEDCOM.

## API

Each genealogy is stored as `server-data/<name>.json`.

- `GET /api/genealogies` — list stored genealogy names.
- `GET /api/genealogy/:name` — returns one genealogy (`{ indis: [], fams: [] }`).
- `PUT /api/genealogy/:name` — creates or replaces a genealogy. Written atomically.

## Project layout

- `src/app/ancestor-chart/` — chart component (Topola `AncestorChart` + `DetailedRenderer`,
  horizontally mirrored), GEDCOM loading, and the edit panel.
- `src/app/ancestor-chart/sample-gedcom.ts` — built-in sample dataset.
- `server.js` — Express server (API + static hosting).
- `server-data/genealogy.json` — persisted genealogy data.
- `proxy.conf.json` — dev-server proxy for `/api`.
