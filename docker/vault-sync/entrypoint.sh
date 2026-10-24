#!/bin/sh
# Waits for the one-time interactive setup, then enforces a download-only,
# narrowed sync on every start and runs continuous sync.
#
# Fails closed: without OB_EXCLUDED_FOLDERS set, it refuses to sync rather than
# risk pulling the whole vault.
set -eu
VAULT="${VAULT_DIR:-/vault}"
: "${OB_EXCLUDED_FOLDERS:?OB_EXCLUDED_FOLDERS must list every top-level folder except the content root}"

until ob sync-status --path "$VAULT" --json >/dev/null 2>&1; do
  echo "vault-sync: waiting for one-time setup. Run:"
  echo "  kubectl exec -it <pod> -c vault-sync -- ob login"
  echo "  kubectl exec -it <pod> -c vault-sync -- ob sync-setup --vault \"<vault>\" --path $VAULT --device-name ${DEVICE_NAME:-tr5k-sh-k3s}"
  sleep 30
done

# Config as code, re-asserted each start:
#   mirror-remote = only download, and revert any local change (cluster can't alter the vault)
#   --configs ""  = don't sync .obsidian app/plugin settings
ob sync-config --path "$VAULT" \
  --mode mirror-remote \
  --configs "" \
  --file-types "${OB_FILE_TYPES:-image,pdf}" \
  --excluded-folders "$OB_EXCLUDED_FOLDERS" \
  --device-name "${DEVICE_NAME:-tr5k-sh-k3s}"
ob sync-config --path "$VAULT"   # log the effective config

exec ob sync --path "$VAULT" --continuous
