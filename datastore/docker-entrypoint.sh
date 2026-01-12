#!/bin/bash
set -e

# Default DB port if not defined
DB_PORT="${DB_PORT:-3306}"

# Default root password, generate if missing
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-$(openssl rand -hex 16)}"

# Initialize MariaDB data dir if empty
if [ ! -d "/var/lib/mysql/mysql" ]; then
    echo "[INIT] Initializing MariaDB database..."
    mysqld --initialize-insecure --user=mysql --datadir=/var/lib/mysql
fi

# Start MariaDB in background
echo "[INIT] Starting MariaDB..."
mysqld_safe --datadir=/var/lib/mysql --skip-networking=0 --port=${DB_PORT} &
MYSQL_PID=$!

# Wait for DB to be ready
until mysqladmin ping --silent; do
    sleep 1
done

echo "[INIT] Setting root password..."
mysql -uroot <<-EOSQL
    ALTER USER 'root'@'localhost' IDENTIFIED BY '${MYSQL_ROOT_PASSWORD}';
    FLUSH PRIVILEGES;
EOSQL

# Launch Node.js controller, logs to stdout/stderr
echo "[INIT] Starting DB controller..."
exec node app.js
