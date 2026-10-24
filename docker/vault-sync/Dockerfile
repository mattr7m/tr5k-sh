# Obsidian Sync, headless. One-time interactive `ob login` + `ob sync-setup`
# (kubectl exec); the session lives in $HOME on its own PVC. The entrypoint
# re-applies the read-only sync config on every start.
ARG NODE_IMAGE=node:22-slim
FROM ${NODE_IMAGE}
ARG OBSIDIAN_HEADLESS_VERSION=0.0.14
RUN npm install -g obsidian-headless@${OBSIDIAN_HEADLESS_VERSION} && npm cache clean --force
COPY docker/vault-sync/entrypoint.sh /usr/local/bin/vault-sync-entrypoint
RUN chmod 0755 /usr/local/bin/vault-sync-entrypoint
USER node
ENV HOME=/home/node VAULT_DIR=/vault DEVICE_NAME=tr5k-sh-k3s
ENTRYPOINT ["/usr/local/bin/vault-sync-entrypoint"]
