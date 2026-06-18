# Container image for the Mobile Concierge API.
# Build context is the server/ directory.
FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# App source.
COPY . .

# The platform provides PORT; default to 4000 for local runs.
ENV PORT=4000
EXPOSE 4000

# tsx runs the TypeScript entrypoint directly (no build step).
CMD ["npm", "run", "start"]
