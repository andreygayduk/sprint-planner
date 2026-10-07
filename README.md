# Sprint Planner

Next.js sprint planning app for scrum sessions — backlog prioritization, sprint commitment, capacity tracking, and multi-team auth.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Auth.js (credentials + optional GitHub OAuth)
- Prisma + PostgreSQL
- `@dnd-kit` for backlog/sprint reorder

## Local setup

### 1. Start Postgres

```bash
docker compose up -d
```

Postgres is exposed on **port 5433** (to avoid clashing with other local databases).

### 2. Environment

```bash
cp .env.example .env
```

Defaults work for local Docker. Generate a strong `AUTH_SECRET` for anything beyond local use. Optionally set `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` for GitHub login.

### 3. Install, migrate, seed

```bash
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo accounts (after seed)

| Email | Password | Role |
|-------|----------|------|
| `owner@example.com` | `password123` | Owner of **Platform** |
| `member@example.com` | `password123` | Member of **Platform** |

Team URL: `/t/platform/backlog`

## Features

- Email/password registration and login (GitHub optional)
- Create teams; path-based tenancy under `/t/[teamSlug]`
- Invite members by email; accept via `/invite/[token]`
- Backlog CRUD with story points, priority, and drag reorder
- Sprints with capacity vs commitment meter
- Assign/unassign backlog items to a sprint board
- Per-member capacity that rolls up to team capacity

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js |
| `npm run build` | Production build |
| `npm run seed` | Load demo user/team/backlog |
| `npx prisma studio` | Browse the database |
