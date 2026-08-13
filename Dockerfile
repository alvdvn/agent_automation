FROM node:18-slim

WORKDIR /app

# Copy files individually
COPY package.json ./
COPY agent ./agent/

# List files to verify
RUN ls -la agent/ || echo "No agent dir"
RUN ls -la agent/scripts/ || echo "No scripts dir"

EXPOSE 8080

CMD ["node", "agent/scripts/api-server.js"]
