# Fallback for Coolify if Railpack ever misbehaves: set Build Pack to "Dockerfile",
# Base Directory "server", Port 3001. The server has no build step.
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY index.js rules.js dictionary.js definition.js room.js words.txt ./
EXPOSE 3001
USER node
CMD ["node", "index.js"]
