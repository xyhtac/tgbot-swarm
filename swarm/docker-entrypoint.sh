#!/usr/bin/env bash
set -e

echo "[INIT] Starting container"

############################
# Required ENV
############################
: "${HOSTNAME:?HOSTNAME is required}"


############################
# Optional ENV + defaults
############################
DEPLOY="${DEPLOY:-prod}"
PROJECT="${PROJECT:-swarm}"
PROXY_PORT="${PROXY_PORT:-443}"
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
# Port validation
############################
for port in "${PROXY_PORT}"; do
  if ! [[ "${port}" =~ ^[0-9]+$ ]] || [ "${port}" -lt 1 ] || [ "${port}" -gt 65535 ]; then
    echo "[ERROR] Invalid port value: ${port}"
    exit 1
  fi
done

# Export for envsubst
export PROXY_PORT HOSTNAME NODE_ENV



############################
# Log effective config
############################
echo "[INIT] DEPLOY=${DEPLOY}"
echo "[INIT] VERBOSE=${VERBOSE}"
echo "[INIT] PROXY_PORT=${PROXY_PORT}"

############################
# Detect container IP
############################
PROXY_IP=$(hostname -i | awk '{print $1}')
echo "[INIT] PROXY_IP=${PROXY_IP}"


############################
# SSL generation
############################

CERT_DIR="/etc/nginx/certs"
mkdir -p "$CERT_DIR"

if [ ! -f "$CERT_DIR/ssl.key" ] || [ ! -f "$CERT_DIR/ssl.pem" ]; then
  echo "[INIT] Generating SSL certificates"
  openssl req -newkey rsa:2048 -sha256 -nodes \
    -keyout "$CERT_DIR/ssl.key" \
    -x509 -days 3650 \
    -out "$CERT_DIR/ssl.pem" \
    -subj "/C=US/ST=New York/L=Brooklyn/O=${PROJECT}/CN=${HOSTNAME}" \
    -addext "subjectAltName=DNS:${HOSTNAME}"

  #openssl req -newkey rsa:2048 -sha256 -nodes \
  #  -keyout "$CERT_DIR/ssl.key" \
  #  -x509 -days 3650 \
  #  -out "$CERT_DIR/ssl.pem" \
  #  -subj "/C=US/ST=New York/L=Brooklyn/O=${PROJECT}/CN=${HOSTNAME}"
  
else
  echo "[INIT] Using existing SSL certificates"
fi

chmod 666 "$CERT_DIR/ssl.key"
chmod 666 "$CERT_DIR/ssl.pem"



############################
# Render nginx config
############################
cd /etc/nginx

envsubst \
  '${PROXY_PORT} ${HOSTNAME}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

echo "[NGINX] Config rendered"


cat /etc/nginx/nginx.conf

nginx -t



############################
# Start services
############################
echo "[NGINX] Starting nginx"
nginx

echo "[NODE] Starting controller"
exec node /app/app.js
