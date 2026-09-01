# Concord frontend

React + TypeScript + Vite single-page app for Concord.

## Stack

- Vite, React, TypeScript
- Tailwind CSS
- React Router
- TanStack Query (server state)
- Zustand (client state, e.g. auth session)
- Vitest + React Testing Library

## Development

```bash
npm install
npm run dev
```

The dev server proxies `/api` and `/ws` to the backend at `http://localhost:8080`
(see `vite.config.ts`), so the app should always call relative paths like
`/api/v1/...` rather than a hardcoded backend URL.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build a production bundle into `dist/`
- `npm run lint` — run ESLint
- `npm run test` — run Vitest in watch mode (`npm run test -- --run` for a single CI run)
- `npm run preview` — preview the production build locally
