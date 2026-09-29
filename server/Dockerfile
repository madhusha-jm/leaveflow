FROM node:20-alpine
WORKDIR /app

# Dependency layer — cached until package files change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Source layer — changes often, so it comes last
COPY . .

ENV NODE_ENV=production
EXPOSE 4000
# Apply any new migrations, then start. `exec` makes node PID 1 so `docker stop`
# (SIGTERM) reaches our graceful shutdown instead of a shell.
CMD ["sh", "-c", "node src/db/migrate.js && exec node src/server.js"]
