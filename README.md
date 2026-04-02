# UA Registry

Static JSON registry of current browser user-agent strings.

This repo publishes full literal UA strings for Chrome, Safari, Edge, and Firefox through GitHub Pages. The output is meant to be easy to consume: no API server, no UA fragment assembly, just plain files under `docs/api/`.

Examples:

- `api/index.json`
- `api/all.json`
- `api/latest.json`
- `api/chrome/latest.json`
- `api/safari/latest.json`
- `api/edge/latest.json`
- `api/firefox/latest.json`

Each entry includes a complete `user_agent` string. Browser-specific top lists always contain 5 unique values.

Official browser release data is used where possible, with a small amount of templating to turn version data into complete UA strings.

```bash
npm test
npm run build
npm run preview
```