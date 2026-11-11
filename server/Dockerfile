FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server/ ./
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node
EXPOSE 4000

# Apply only pending migrations to the local database before starting the API.
CMD ["sh", "-c", "npm run migrate && npm start"]
