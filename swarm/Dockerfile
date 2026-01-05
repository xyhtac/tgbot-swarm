FROM alpine:3.19

### System dependencies ###
RUN apk add --no-cache \
    nginx \
    nodejs \
    npm \
    openssl \
    bash \
    ca-certificates \
    gettext 

### Runtime dirs ###
RUN mkdir -p \
    /run/nginx \
    /etc/nginx \
    /app

### Nginx config template ###
RUN rm -f /etc/nginx/http.d/default.conf
COPY proxy/conf/nginx.conf.template /etc/nginx/nginx.conf.template
COPY proxy/content /usr/share/nginx/html

### Node app ###
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

### Entrypoint ###
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 443

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
