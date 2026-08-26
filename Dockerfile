# One image that serves both the built site and the API.
FROM node:22-slim

WORKDIR /app

# Front-end dependencies and build.
COPY package*.json ./
RUN npm ci
COPY index.html vite.config.js eslint.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build

# API dependencies.
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev
COPY server ./server

# The database lives on a mounted volume so collected posts survive a redeploy.
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["node", "server/index.js"]
