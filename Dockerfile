# Image de l'application (build en trois étapes pour une image finale légère et sans outils de développement)

# 1. Construction de l'interface Vue (Vite)
FROM node:22-alpine AS interface
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY client ./client
RUN npm run build

# 2. Dépendances de production du serveur
FROM node:22-alpine AS dependances
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 3. Image finale
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# Exécution avec un utilisateur non privilégié (principe du moindre privilège)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=dependances /app/node_modules ./node_modules
COPY --from=interface /app/client/dist ./client/dist
COPY package.json ./
COPY src ./src
COPY db ./db
COPY scripts ./scripts
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "src/server.js"]
