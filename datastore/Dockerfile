# Use Node 20 alpine as base
FROM node:20-alpine

# database port (from env)
ARG DB_PORT=3306

# Install MariaDB client and server, bash, openssl
RUN apk add --no-cache mariadb mariadb-client bash openssl curl

# Set workdir
WORKDIR /app

# Copy package files
COPY package.json ./

# Install Node dependencies
RUN npm install

# Copy application code
COPY . ./

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh


EXPOSE ${DB_PORT}

# Entrypoint
ENTRYPOINT ["/app/docker-entrypoint.sh"]
