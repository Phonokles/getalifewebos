FROM node:20-alpine

WORKDIR /app

# install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# application
COPY server.js ./
COPY code ./code

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

USER node

CMD ["node", "server.js"]
