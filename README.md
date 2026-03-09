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
- `public/data/entities-core.json`: canonical entity metadata (no geometry)
- `public/data/pack-index.json`: map of `packId -> entityIds[]`
- `public/data/pack-entity-meta.source.json`: editable per-pack metadata input (rank/metric/etc.)
- `public/data/pack-entity-meta.json`: generated per-pack metadata map used at runtime
- `public/data/entity-geometry-index.json`: map of `entityId -> shardId`
- `public/data/entity-geometry-shards/<shardId>.json`: geometry payloads sharded by entity id hash
- `public/data/entities-index.json`: lightweight global index
- `public/data/sample-entities.json`: editable source used by `npm run build:data`

## Deploy

Push to `main` to trigger `.github/workflows/deploy.yml`.

Important: in GitHub repository settings, set Pages source to **GitHub Actions**.
