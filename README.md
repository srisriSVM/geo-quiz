# geo-bee-trainer

Phase 1 scaffold for a Geo Bee map trainer app.

## Local development

```bash
npm install
npm run build:data
npm run dev
```

## Production build

```bash
npm run build:data
npm run build
```

## Data layout

- `public/data/packs.json`: pack definitions
- `public/data/pack-entities/<packId>.entities.json`: entities for each pack (lazy-loaded)
- `public/data/entities-index.json`: lightweight global index
- `public/data/sample-entities.json`: editable source used by `npm run build:data`

## Deploy

Push to `main` to trigger `.github/workflows/deploy.yml`.

Important: in GitHub repository settings, set Pages source to **GitHub Actions**.
