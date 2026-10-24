# Site builder: watches the vault (mounted read-only) and writes the public and
# private sites into separate output volumes.
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY assets ./assets
COPY site.config.json ./
USER node
ENV VAULT_DIR=/vault PUBLIC_OUT=/out/public PRIVATE_OUT=/out/private
CMD ["node", "src/watch.js"]
