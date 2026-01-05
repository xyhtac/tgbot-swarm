#!/usr/bin/env bash
set -e

echo "[INIT] Starting container"

############################
# Required ENV
############################
: "${HOSTNAME:?HOSTNAME is required}"
: "${API_KEY:?API_KEY is required}"

############################
# Optional ENV + defaults
############################
DEPLOY="${DEPLOY:-prod}"
PROJECT="${PROJECT:-MyProject}"

API_PATH="${API_PATH:-/controller}"
PROXY_PORT="${PROXY_PORT:-443}"
API_PORT="${API_PORT:-8081}"

VERBOSE="${VERBOSE:-false}"

############################
# DEPLOY validation
############################
case "${DEPLOY}" in
  dev|prod|alpha|staging)
    ;;
  *)
    echo "[ERROR] Invalid DEPLOY value: '${DEPLOY}'"
    echo "[ERROR] Allowed values: dev | prod | alpha | staging"
    exit 1
    ;;
esac

############################
# VERBOSE normalization (bool-safe)
############################
case "${VERBOSE,,}" in
  true|1|yes)
    VERBOSE=true
    ;;
  false|0|no)
    VERBOSE=false
    ;;
  *)
    echo "[ERROR] Invalid VERBOSE value: '${VERBOSE}'"
    echo "[ERROR] Allowed values: true|false|1|0|yes|no"
    exit 1
    ;;
esac

############################
# API_PATH validation
############################
if [[ ! "${API_PATH}" =~ ^/ ]]; then
  echo "[ERROR] API_PATH must start with '/' (got '${API_PATH}')"
  exit 1
fi

############################
# Port validation
############################
for port in "${PROXY_PORT}" "${API_PORT}"; do
  if ! [[ "${port}" =~ ^[0-9]+$ ]] || [ "${port}" -lt 1 ] || [ "${port}" -gt 65535 ]; then
    echo "[ERROR] Invalid port value: ${port}"
    exit 1
  fi
done

# Export for envsubst
export API_PORT PROXY_PORT API_PATH HOSTNAME NODE_ENV



############################
# Log effective config
############################
echo "[INIT] DEPLOY=${DEPLOY}"
echo "[INIT] VERBOSE=${VERBOSE}"
echo "[INIT] API_PATH=${API_PATH}"
echo "[INIT] PROXY_PORT=${PROXY_PORT}"
echo "[INIT] API_PORT=${API_PORT}"

############################
# Detect container IP
############################
PROXY_IP=$(hostname -i | awk '{print $1}')
echo "[INIT] PROXY_IP=${PROXY_IP}"

############################
# SSL generation
############################
cd /etc/nginx

openssl req -newkey rsa:2048 -sha256 -nodes \
  -keyout ssl.key \
  -x509 -days 3650 \
  -out ssl.pem \
  -subj "/C=US/ST=New York/L=Brooklyn/O=${PROJECT}/CN=${HOSTNAME}"

echo "[INIT] SSL certificates generated"

############################
# Render nginx config
############################
envsubst \
  '${PROXY_PORT} ${HOSTNAME} ${API_PATH} ${API_PORT}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

echo "[NGINX] Config rendered"
cat /etc/nginx/nginx.conf

nginx -t

############################
# Generate application config
############################
cd /app

CONFIG_DIR="/app/config"
export NODE_CONFIG_DIR="${CONFIG_DIR}"
CONFIG_FILE="${CONFIG_DIR}/local-${DEPLOY}.json"

mkdir -p "${CONFIG_DIR}"

cat > "${CONFIG_FILE}" <<EOF
{
  "controller": {
    "host": "127.0.0.1",
    "port": "8081"
  },
  "proxy": {
    "host": "${PROXY_IP}",
    "port": "${PROXY_PORT}",
    "fqdn": "${HOSTNAME}"
  },
  "defaults": {
    "verbose": ${VERBOSE},
    "portrange": [3002, 4000],
    "proxycmd": "/usr/sbin/nginx -s reload",
    "payloads": "config/payloads.json",
    "nginxconfig": "/etc/nginx/endpoints.conf",
    "certificate": "ssl.pem",
    "sslkey": "ssl.key"
  },
  "api": {
    "key": "${API_KEY}"
  }
}
EOF

echo "[INIT] App config written: ${CONFIG_FILE}"

############################
# Start services
############################
echo "[NGINX] Starting nginx"
nginx

echo "[NODE] Starting controller"
exec node /app/api-controller.js
