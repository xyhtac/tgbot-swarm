#!/usr/bin/env bash
set -e

STATE_DIR=/app/state
STATE_FILE="${STATE_DIR}/.env"

# Ensure state dir exists
mkdir -p "$STATE_DIR"

# Default DB port
DB_PORT="${DB_PORT:-3306}"
export DB_PORT
echo "Chosen port ${DB_PORT}"

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

mkdir -p /run/mysqld
chown -R mysql:mysql /run/mysqld

if [ ! -d "/var/lib/mysql/mysql" ]; then
    mariadb-install-db --user=mysql --datadir=/var/lib/mysql
fi

# Start MariaDB in background
#mysqld --user=mysql --port=$DB_PORT --datadir=/var/lib/mysql &


# Start MariaDB in background

mariadbd \
  --user=mysql \
  --datadir=/var/lib/mysql \
  --skip-networking=0 \
  --bind-address=0.0.0.0 \
  --port="$DB_PORT" &

DB_PID=$!

echo "Waiting for MariaDB..."
until mariadb-admin ping --host=127.0.0.1 --port="$DB_PORT" --silent; do
  sleep 1
done

if [ ! -f /app/state/.root-initialized ]; then
  echo "Initializing MariaDB root user..."

  mariadb -u root <<EOF
ALTER USER 'root'@'localhost'
  IDENTIFIED VIA mysql_native_password
  USING PASSWORD('${MYSQL_ROOT_PASSWORD}');
FLUSH PRIVILEGES;
EOF

  touch /app/state/.root-initialized
fi

echo "Verify network login..."
until mariadb-admin ping \
  --host=127.0.0.1 \
  --port="$DB_PORT" \
  --user=root \
  --password="${MYSQL_ROOT_PASSWORD}" &>/dev/null; do
    echo "Waiting for database..."
    sleep 1
done

echo "[INIT] Starting DB controller app..."
exec node /app/app.js
