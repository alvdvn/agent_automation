FROM node:18-slim

WORKDIR /app

COPY . .

RUN echo "=== BUILD TIME: $(date) ===" 
RUN echo "=== FILES IN /app ===" && ls -la
RUN echo "=== FILES IN /app/agent ===" && ls -la agent/ || echo "NO AGENT"
RUN echo "=== FILES IN /app/agent/scripts ===" && ls -la agent/scripts/ || echo "NO SCRIPTS"

EXPOSE 8080

CMD ["node", "agent/scripts/api-server.js"]
