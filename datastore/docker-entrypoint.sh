#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="/app/state"
DOCKER_SOCKET="${DOCKER_SOCKET:-/tmp/docker.sock}"
DB_PORT="${DB_PORT:-3306}"

mkdir -p "$STATE_DIR"

# MySQL root password handling
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"
if [[ -z "$MYSQL_ROOT_PASSWORD" ]]; then
    if [[ -f "$STATE_DIR/mysql-root.secret" ]]; then
        MYSQL_ROOT_PASSWORD=$(<"$STATE_DIR/mysql-root.secret")
    else
        MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
        echo "$MYSQL_ROOT_PASSWORD" > "$STATE_DIR/mysql-root.secret"
        chmod 600 "$STATE_DIR/mysql-root.secret"
        echo "[INIT] Generated MySQL root password and saved to state"
    fi
fi
export MYSQL_ROOT_PASSWORD

# Start MySQL in background
echo "[INIT] Starting MySQL..."
mysqld_safe --port=$DB_PORT &

# Wait for MySQL to become ready
until mysqladmin ping -h 127.0.0.1 --silent; do
    sleep 1
done
echo "[INIT] MySQL ready on port $DB_PORT"

# Start Node controller
echo "[INIT] Starting Node controller..."
exec node /app/app.js
