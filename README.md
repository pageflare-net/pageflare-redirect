# Pageflare Redirect

A modern URL redirect manager with analytics. Create, manage, and track redirects with detailed statistics and health monitoring.

## What this is

Pageflare Redirect is a full-stack application for setting up, managing, and tracking HTTP/HTTPS redirects. Users can create short URLs that redirect to longer destinations, view real-time redirect statistics with configurable date ranges, and test their redirect configurations to ensure they're working correctly.

### Stack

- **Language(s):** TypeScript (frontend and backend)
- **Frontend Framework:** React 19 + Vite + Tailwind CSS
- **Backend Framework:** Node.js + Express
- **Database:** MongoDB
- **UI Components:** shadcn/ui + Radix UI
- **Notable libraries:**
  - `recharts` — analytics visualization
  - `helmet` — HTTP security headers
  - `jsonwebtoken` — JWT authentication
  - `express-rate-limit` — rate limiting
  - `zod` — runtime schema validation

## How it's organized

```
.
├── backend/                    Express API server
│   ├── src/
│   │   ├── index.ts           Application entry point
│   │   ├── mongo.ts           MongoDB operations and data models
│   │   ├── logger.ts          Winston logging configuration
│   │   ├── routes/
│   │   │   ├── api.ts         Authentication, config, stats endpoints
│   │   │   ├── redirect.ts    HTTP redirect handler
│   │   │   └── ui.ts          Frontend data aggregation
│   │   └── middlewares/
│   │       ├── rateLimit.ts   Global rate limiting
│   │       ├── authenticate.ts JWT validation
│   │       └── validate.ts    Zod schema validation
│   └── tsconfig.json
│
├── frontend/                  React dashboard UI
│   ├── src/
│   │   ├── App.tsx           Main app component with auth flow
│   │   ├── components/
│   │   │   ├── RedirectStats.tsx  Stats table and charts
│   │   │   ├── Navbar.tsx    Navigation and time range selector
│   │   │   ├── AddRedirectDialog.tsx  Create redirect modal
│   │   │   ├── LoginForm.tsx       Authentication form
│   │   │   └── ui/           shadcn/ui component library
│   │   ├── index.css         Tailwind styles
│   │   └── main.tsx          React entry point
│   ├── vite.config.ts        Vite build configuration
│   └── tsconfig.app.json
│
├── Dockerfile               Multi-stage Docker build
├── docker-compose.yml       Local development setup
├── package.json            Workspace root config
├── pnpm-workspace.yaml     pnpm monorepo declaration
└── turbo.json             Turbo build orchestration
```

**How it fits together:**
The backend connects to MongoDB on startup and registers API routes (`/api/*`), redirect handler routes (`/redirect/*`), and UI data aggregation routes (`/ui/*`). The frontend (built by Vite) authenticates users via JWT, fetches redirect configurations and statistics from `/api/ui-data`, and presents a dashboard for managing redirects and viewing analytics. When a user visits a redirect URL (e.g., `example.com`), the redirect handler looks it up in MongoDB, logs the access as a statistic, and returns an HTTP redirect to the target URL.

## How to run it

### Prerequisites
- Node.js 18+
- MongoDB (local or remote URI)
- pnpm 9.6.0

### Development

```bash
# Install dependencies
pnpm install

# Start both frontend and backend with hot reload
pnpm dev
```

The frontend will run on `http://localhost:5173` (Vite dev server) and the backend on `http://localhost:3000`.

### Production

**Using Docker Compose:**
```bash
# Create a .env file in the project root
echo "JWT_SECRET=your-secret-key" > .env
echo "VITE_API_BASE_URL=http://your-api-domain.com" >> .env

# Build and run
docker-compose up --build
```

The app will be accessible on `http://localhost` (port 80).

**Manual build:**
```bash
# Frontend
cd frontend
pnpm build

# Backend
cd ../backend
pnpm build
VITE_API_BASE_URL=http://localhost:3000 NODE_ENV=production node dist/index.js
```

### Environment Variables

**Backend (.env):**
- `PORT` — Express server port (default: 3000)
- `NODE_ENV` — "production" or "development"
- `JWT_SECRET` — Secret key for signing JWTs (required in production)
- `MONGO_URI` — MongoDB connection string (default: `mongodb://localhost:27017/redirects`)

**Frontend (.env):**
- `VITE_API_BASE_URL` — Backend API base URL (default: `http://localhost:3000`)

## Features

- **Create Redirects** — Set up short domain redirects with source and target URLs
- **Track Statistics** — Monitor redirect counts with daily breakdowns
- **Time Range Filtering** — View stats for last 7/30/365 days or all-time
- **Health Monitoring** — Test HTTP and HTTPS redirect configurations
- **Search & Filter** — Find redirects by source domain or target URL
- **Responsive Design** — Works on mobile, tablet, and desktop
- **Dark Mode Support** — Light and dark theme options
- **JWT Authentication** — Secure login system with token-based auth
- **Rate Limiting** — Prevent abuse with per-IP request limits
- **Docker Ready** — Includes Dockerfile and docker-compose for easy deployment

## Try asking

- How does authentication work in the backend?
- How are redirect statistics tracked and visualized?
- How does the redirect test endpoint verify redirect configurations?
