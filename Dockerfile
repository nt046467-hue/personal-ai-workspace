# ==========================================
# Stage 1: Build Client (Vite)
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript & Vite)
RUN npm ci

# Copy source code and configuration
COPY . .

# Build production client bundle into /app/dist
RUN npm run build

# ==========================================
# Stage 2: Production Server Runner
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_DIR=/app/storage

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built frontend assets from builder
COPY --from=builder /app/dist ./dist

# Copy backend server code and tsconfig
COPY server ./server
COPY tsconfig.json tsconfig.node.json tsconfig.app.json ./

# Create storage directory for SQLite database and uploads
RUN mkdir -p /app/storage

# Expose server port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start production server
CMD ["node", "--import", "tsx", "server/index.ts"]
