# Base image with Node 20 and MySQL 8
FROM node:20-bullseye

# Install MySQL
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y mysql-server openssl && \
    rm -rf /var/lib/apt/lists/*

# Working directory
WORKDIR /app

# Copy Node dependencies and install
COPY package.json ./
RUN npm install 

# Copy app code
COPY . .

# Expose default ports (MySQL + controller dynamic port)
EXPOSE ${DB_PORT:-3306}

# Entrypoint
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "/app/app.js"]