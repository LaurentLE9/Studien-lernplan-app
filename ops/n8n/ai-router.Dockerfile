FROM node:22.19.0-alpine3.22

WORKDIR /app
COPY ai-router.mjs ai-router-server.mjs model-router.mjs ./
RUN mkdir -p /var/lib/ai-router && chown node:node /var/lib/ai-router

USER node
CMD ["node", "ai-router-server.mjs"]
