FROM mariadb:10.11

# Install Node.js + required tools
RUN apt-get update && \
    apt-get install -y curl ca-certificates openssl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install controller dependencies
COPY package.json ./
RUN npm install --production

# Copy controller source
COPY app.js docker-entrypoint.sh ./
RUN chmod +x /app/docker-entrypoint.sh

# MariaDB data volume
VOLUME ["/var/lib/mysql"]

EXPOSE ${DB_PORT:-3306}

ENTRYPOINT ["/app/docker-entrypoint.sh"]
