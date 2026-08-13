FROM node:18-slim

WORKDIR /app

# Copy everything from repo
COPY . .

# Verify
RUN ls -la
RUN pwd
RUN ls -la agent/ || echo "no agent"
RUN ls -la agent/scripts/ || echo "no scripts"

EXPOSE 8080

CMD ["node", "agent/scripts/api-server.js"]