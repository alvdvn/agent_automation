FROM node:18-slim

WORKDIR /app

COPY package.json ./
COPY agent/ ./agent/

EXPOSE 8080

CMD ["node", "agent/scripts/api-server.js"]