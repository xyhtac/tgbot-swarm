#!/usr/bin/env bash
set -e

STATE_DIR=/app/state
STATE_FILE="${STATE_DIR}/.env"

# Ensure state dir exists
mkdir -p "$STATE_DIR"

# Default DB port
DB_PORT="${DB_PORT:-3306}"
export DB_PORT

# Generate root password if not exists
if [ -f "$STATE_FILE" ]; then
    # Load saved state
    export $(grep -v '^#' "$STATE_FILE" | xargs)
else
    if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
        MYSQL_ROOT_PASSWORD=$(openssl rand -hex 16)
    fi
    echo "MYSQL_ROOT_PASSWORD=$MYSQL_ROOT_PASSWORD" > "$STATE_FILE"
    chmod 600 "$STATE_FILE"
fi

echo "[INIT] Starting MariaDB..."
# Initialize MariaDB data directory if needed
chown -R mysql:mysql /var/lib/mysql
chmod 700 /var/lib/mysql

if [ ! -d "/var/lib/mysql/mysql" ]; then
    mariadb-install-db --user=mysql --datadir=/var/lib/mysql
fi

# Start MariaDB in background
#mysqld --user=mysql --port=$DB_PORT --datadir=/var/lib/mysql &
#MYSQL_PID=$!

# Start MariaDB in background
mysqld_safe --datadir=/var/lib/mysql &
# Wait until ready
until mysqladmin ping -h 127.0.0.1 --silent; do
    echo "Waiting for database..."
    sleep 1
done

# Start Node.js DB controller
node /app/app.js

# Wait a few seconds for DB to start
sleep 5

# Start Node application
echo "[INIT] Starting DB controller app..."
exec node /app/app.js
