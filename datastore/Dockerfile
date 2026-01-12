# Use Node 20 on Debian slim
FROM node:20-slim

# Set workdir
WORKDIR /app

# Install MariaDB client & server and required tools
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        mariadb-server mariadb-client openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy package.json and install Node dependencies
COPY package.json ./
RUN npm install --production

# Copy app code
COPY . .

# Expose DB port
EXPOSE ${DB_PORT:-3306}

# Entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]