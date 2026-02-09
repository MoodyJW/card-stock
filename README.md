# CardStock

> **⚠️ PROPRIETARY SOFTWARE - ALL RIGHTS RESERVED**
>
> This software is made available on GitHub for **portfolio and demonstration purposes only**.
>
> - ❌ **Commercial use is prohibited**
> - ❌ **Forking, copying, or modification is prohibited**
> - ❌ **Redistribution is prohibited**
>
> See [LICENSE](./LICENSE) for full terms. Unauthorized use may result in legal action.

---

A mobile-first, multi-tenant SaaS inventory management system for Pokémon card stores.

## Tech Stack

- **Frontend:** Angular 21 (Signals, Standalone Components, Angular Material)
- **Mobile:** Capacitor (Android/iOS) - *planned*
- **Backend:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Testing:** Vitest, Playwright, pgTAP
- **DevOps:** GitHub Actions CI/CD

---

## Prerequisites

- Node.js 22+
- npm 11+
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

## Development Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Start Supabase locally

```bash
npx supabase start
```

This starts local PostgreSQL, Auth, and Studio. Access Studio at `http://localhost:54323`.

### 3. Start the dev server

```bash
npm start
```

App runs at `http://localhost:4200/`. Auto-reloads on file changes.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run test` | Run unit tests (Vitest) |

---

## Project Structure

```
src/app/
├── core/           # Guards, services, models, error handling
├── features/       # Feature modules (auth, inventory, import)
├── shared/         # Reusable components
└── layouts/        # Auth and main layouts
```

See [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) for full architecture details.

---

## Additional Resources

- [Angular CLI Reference](https://angular.dev/tools/cli)
- [Supabase Documentation](https://supabase.com/docs)
- [Angular Material](https://material.angular.io/)
