FROM oven/bun:1.4.3 AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN bun install --frozen-lockfile
COPY frontend frontend
COPY backend backend
RUN bun run build
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "backend/dist/index.js"]
