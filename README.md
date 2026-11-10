# api

The backend for lichenic, a new social media app.

## Setup

pnpm and nodejs are required.

1. Install dependencies:

```bash
pnpm i
```

2. Start the dev server:

```bash
pnpm dev
```

3. Check the health endpoint:

```bash
curl localhost:3011/health
```

It should return:

```json
{ "ok": true }
```
