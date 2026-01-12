#!/bin/sh
set -e

echo "[INIT] Starting MariaDB + Swarm DB controller"
DOCKER_SOCKET="${DOCKER_SOCKET:-/tmp/docker.sock}"
DB_PORT="${DB_PORT:-3306}"

# Generate root password if missing
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
  MYSQL_ROOT_PASSWORD="$(openssl rand -base64 24)"
  export MYSQL_ROOT_PASSWORD
  echo "[INIT] Generated MySQL root password"
fi

# Start MariaDB in background
docker-entrypoint.sh mysqld &
MYSQL_PID=$!

# Wait for DB
echo "[INIT] Waiting for MariaDB..."
until mysqladmin ping -uroot -p"$MYSQL_ROOT_PASSWORD" --silent; do
  sleep 1
done

echo "[INIT] MariaDB is ready"

# Start controller
echo "[INIT] Starting Node controller"
node /app/app.js &

wait $MYSQL_PID
