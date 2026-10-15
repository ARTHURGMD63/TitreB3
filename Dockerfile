# Image de l'application (build en deux étapes pour une image finale légère et sans outils de développement)
FROM node:22-alpine AS dependances
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
# Exécution avec un utilisateur non privilégié (principe du moindre privilège)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=dependances /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY db ./db
COPY scripts ./scripts
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "src/server.js"]
