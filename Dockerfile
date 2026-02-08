# Build web
FROM node:20-alpine AS web-build
WORKDIR /web
COPY web/package.json web/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY web/ ./
RUN npm run build

# Build server
FROM node:20-alpine AS server-build
WORKDIR /server
COPY server/package.json server/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY server/ ./
RUN npm run build

# Runtime
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=server-build /server/package.json ./package.json
COPY --from=server-build /server/node_modules ./node_modules
COPY --from=server-build /server/dist ./dist
COPY --from=web-build /web/dist ./public
ENV STATIC_DIR=/app/public
EXPOSE 8080
CMD ["node", "dist/index.js"]
