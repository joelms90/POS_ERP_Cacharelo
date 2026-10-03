# Stage 1: Build
FROM node:20-alpine AS builder

# Install pnpm (pinned: pnpm 12+ hard-fails on ignored dependency build scripts)
RUN npm install -g pnpm@10.34.5

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies)
RUN pnpm install --frozen-lockfile

# Copy codebase
COPY . .

# Build NestJS app
RUN pnpm build

# Stage 2: Production Runtime
FROM node:20-alpine AS runner

# Install pnpm (pinned: pnpm 12+ hard-fails on ignored dependency build scripts)
RUN npm install -g pnpm@10.34.5

WORKDIR /app

ENV NODE_ENV=production

# Copy package and lock files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built code from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations

# Expose port
EXPOSE 8080

# Run application
CMD ["node", "dist/main"]
