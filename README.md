![](img/swarm-head-2.jpg)
Run multiple stateful Telegram bots on a single host

[![tgbot-swarm-2.0](https://img.shields.io/badge/dev-tgbot_swarm_2.0-7a00b9)](https://github.com/xyhtac/tgbot-swarm/releases/tag/v.2.0)

### TL&DR.
tgbot-swarm sets up a container running nginx and nodejs controller that generates reverse proxy configs for nginx and reloads nginx when containers are started and stopped. It also creates self-signed certificate and exposes it through docker shared volume, making it easy to start multiple containers serving independent Telegram bots on a single host.

#### Quick start
```
git clone https://github.com/xyhtac/tgbot-swarm.git
cd tgbot-swarm
sudo mkdir -p \
  /opt/swarm-certificate \
  /opt/swarm-datastore \
  /opt/swarm-datastore-state
export BOT_TOKEN=telegram_bot_token
export SWARM_DB_PASS=database_password_for_bot_application
docker compose up -d
```

### Docker Usage

Make sure Docker (20.10+) is installed on your system: `docker --version`

#### Create required directories and volumes
```
# Certificates
sudo mkdir -p /opt/swarm-certificate
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/opt/swarm-certificate \
  --opt o=bind \
  tgbot-swarm-certificates

# Database storage
sudo mkdir -p /opt/swarm-datastore
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/opt/swarm-datastore \
  --opt o=bind \
  tgbot-swarm-datastore

# Datastore controller state
sudo mkdir -p /opt/swarm-datastore-state
docker volume create \
  --driver local \
  --opt type=none \
  --opt device=/opt/swarm-datastore-state \
  --opt o=bind \
  tgbot-swarm-datastore-state

```

#### Create Docker network
```
docker network inspect tgbot-swarm >/dev/null 2>&1 || \
docker network create --driver bridge tgbot-swarm

```

#### Run separate docker containers
```
# Spin up tgbot-swarm nginx + controller
docker run -d --name tgbot-swarm-controller \
    --restart unless-stopped \
    --network tgbot-swarm \
    -v /var/run/docker.sock:/tmp/docker.sock:ro \
    -v tgbot-swarm-certificates:/etc/nginx/certs \
    -e HOSTNAME=foo.bar.com \
    -p 443:443/tcp  \
xyhtac/tgbot-swarm:latest

# Spin up tgbot-swarm mariadb + controller
docker run -d --name tgbot-swarm-datastore \
    --restart unless-stopped \
    --network tgbot-swarm \
    -v /var/run/docker.sock:/tmp/docker.sock:ro \
    -v tgbot-swarm-datastore:/var/lib/mysql \
    -v tgbot-swarm-datastore-state:/app/state \
    -e DB_PORT=3306 \
xyhtac/tgbot-swarm-datastore:latest

# Spin up an example Telegram bot
docker run -d --name tgbot-swarm-samplebot \
    --restart unless-stopped \
    --network tgbot-swarm \
    -e BOT_TOKEN=[SECRET_BOT_TOKEN] \
    -e SWARM_DB_PASS=[SECRET_DB_PASSWORD] \
    -e SWARM_DB_HOST=tgbot-swarm-datastore \
    -e SWARM_DB_STORE=samplebot \
    -e SWARM_PATH=samplebot \
    -e SWARM_PORT=3300 \
    -v tgbot-swarm-certificates:/app/certs:ro \
    -p 3300:3300/tcp  \
xyhtac/tgbot-swarm-samplebot:latest

```



### Abstract.
Telegram offers JSON-based, accessible via a RESTful control [webhook API](https://core.telegram.org/bots/API) updates to push data to the handler application running as a publicly available https server on one of valid ports (80, 443, 88 or 8443) with self-signed or CA-signed certificate. A frugal build-and-forget methodology is oftentimes preferred to avoid the costs of using fancy off-site CI/CD platforms and no-code services. Popular and well-maintained open source bot libraries widely used by developers ([Telebot](https://github.com/mullwar/telebot), [Telegraf](https://github.com/telegraf/telegraf), etc.) may serve several bot tokens per process, but it comes with a cost of combining multiple bot logic into one source repo. 

### Problem.
Running multiple instances of dockerized bot applications on a single host considering a limited number of allowed ports requires nginx reverse proxy to take care of connection dispatch. Configuration of nginx has to be carefully maintained in regard with actual port settings of docker containers; nginx SSL-certificates also have to be consistent with all deployed bot applications. No external [container orchestration](https://docs.docker.com/engine/swarm/) and no [nginx control API](https://unit.nginx.org/controlapi/) are allowed by the conditions of our task since we are about to fit one standalone host. Therefore, the amount of manwork required to set-up and maintain single-host multi-bot dockerized infrastructure is significantly higher than the development process of the bot itself.

### Solution.
To minimise our efforts in bot hosting deployment `tgbot-swarm` solves two scopes of tasks:

1. Provide a dockerized controller that monitors other containers through the docker.sock and extracts their environment parameters, generate and keep updated relevant nginx configurations that connect hostname paths to running containers, generate self-signed certificates and expose them via shared docker volume.

2. Provide Jenkins groovy pipelines to automate build, configuration and deployment of a controller/proxy container and an example bot container binding your bots to unique paths using UUID and automatically choosing available port on the host from a given range.



### License
`tgbot-swarm` is licensed under the [MIT](https://www.mit-license.org/) license for all open source applications.

### Bugs and feature requests

Please report bugs [here on Github](https://github.com/xyhtac/check_sateon/issues).
Guidelines for bug reports:
1. Use the GitHub issue search — check if the issue has already been reported.
2. Check if the issue has been fixed — try to reproduce it using the latest master or development branch in the repository.
3. Isolate the problem — create a reduced test case and a live example. 

A good bug report shouldn't leave others needing to chase you up for more information.
Please try to be as detailed as possible in your report.
Feature requests are welcome. Please look for existing ones and use GitHub's "reactions" feature to vote.
