FROM node:22.19.0-alpine3.22

WORKDIR /app
COPY --chown=node:node webhook-verifier.mjs /app/webhook-verifier.mjs
RUN mkdir -p /var/lib/webhook-verifier/deliveries \
    && chown -R node:node /var/lib/webhook-verifier

USER node
CMD ["node", "/app/webhook-verifier.mjs"]
