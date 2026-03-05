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

## Deploy

Push to `main` to trigger `.github/workflows/deploy.yml`.

Important: in GitHub repository settings, set Pages source to **GitHub Actions**.
