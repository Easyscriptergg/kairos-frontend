# kairos-frontend

The web app for **Kairos**, an athlete performance platform: training, recovery, nutrition, performance and insights in one place.

React 18 · TypeScript · Vite · React Router · Recharts · plain CSS design tokens. The backend is the separate Spring Boot repository `kairos-backend`.

## Data sources

The app runs against one of three sources, chosen in **Settings** and always labelled in the navigation:

| Source | When | Stored where |
|---|---|---|
| **Kairos account** | `VITE_API_BASE_URL` is set (production) | PostgreSQL, through the API; needs sign-in |
| **Demo data** | Always available | A deterministic sample athlete built in the browser; nothing real |
| **Saved on this device** | Always available | This browser's localStorage only; no account, no backup |

Sources never copy data into each other. When the API is unreachable or rejects a request, the app says so; it never shows sample data in place of an answer.

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173 (demo and on-device sources only)
```

To use the real API, run `kairos-backend` locally (`./mvnw spring-boot:test-run`, which needs no PostgreSQL install), then:

```bash
# .env.local
VITE_API_BASE_URL=http://localhost:8080/api
```

…and restart `npm run dev`. The local backend seeds `demo@kairos.local` / `kairos-local-demo`.

## Build

```bash
npm run build      # type-check and build to dist/
npm run preview    # serve dist/ locally
```

## Where things are

```
src/data/domain/     calculations: scores, loads, insights (all formulas documented in code)
src/data/api/        API client, auth session, wire contract, repositories for each source
src/data/store/      React context holding records and everything derived from them
src/data/demo/       deterministic demo athlete
src/components/      app shell, sign-in, shared design-system components, charts
src/pages/           the ten pages
docs/API_CONTRACT.md the REST contract with kairos-backend
docs/DEPLOYMENT.md   deploying to Vercel and Render
```

## Honest limits

- There is no AI model. "Ask Kairos" says so, and insights are fixed comparisons over your own records.
- No wearable is connected. The Connections page lists planned providers as not connected.
- Scores (recovery, athlete balance, readiness) are internal calculations, not medical measures; each page explains its formula.
