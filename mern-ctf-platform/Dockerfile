# ---- Build Frontend ----
FROM node:20-alpine AS client-build

WORKDIR /app/client
COPY client/package.json ./
RUN npm install
COPY client/ .
RUN npm run build

# ---- Build Backend ----
FROM node:20-alpine AS server-build

WORKDIR /app/server
COPY server/package.json ./
RUN npm install --production
COPY server/ .

# ---- Production ----
FROM node:20-alpine

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=server-build /app/server ./server
COPY --from=client-build /app/client/dist ./client/dist

RUN mkdir -p /app/server/uploads/banners /app/server/uploads/challenges && \
    chown -R appuser:appgroup /app/server/uploads

EXPOSE 5000

USER appuser
CMD ["node", "server/index.js"]
