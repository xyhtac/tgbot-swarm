![](https://images4.imagebam.com/49/a5/01/MEQST5U_o.jpg)
Run multiple Telegram bots on a single host

### Abstract.
Telegram offers JSON-based, accessible via a RESTful control [webhook API](https://core.telegram.org/bots/API) updates to push data to the handler application running as a publicly available https server on one of valid ports (80, 443, 88 or 8443) with self-signed or CA-signed certificate. A frugal build-and-forget methodology is oftentimes preferred to avoid the costs of using fancy off-site CI/CD platforms and no-code services. Popular and well-maintained opensource bot libraries widely used by developers ([Telebot](https://github.com/mullwar/telebot), [Telegraf](https://github.com/telegraf/telegraf), etc.) usually serve only one bot token per process.

### Problem.
Running multiple instances of dockerized bot applications on a single host considering a limited number of allowed ports requires nginx reverse proxy to take care of connection dispatch. Configuration of nginx has to be carefully maintained in regard with actual port settings of docker containers; nginx SSL-certificates also have to be consistent with all deployed bot applications. No external [container orchestration](https://docs.docker.com/engine/swarm/) and no [nginx control API](https://unit.nginx.org/controlapi/) are allowed by the conditions of our task since we are about to fit one standalone host. Therefore, the amount of manwork required to set-up and maintain single-host multi-bot dockerized infrastructure is significantly higher than the development process of the bot itself.

### Solution.
To minimise our efforts in bot hosting deployment `tgbot-swarm` solves two scopes of tasks:

1. Provide a built-in API that employs port, path and SSL-certificate assignment mechanism and a relevant proxy config generation. In a nutshell it is a node.js-express controller application that runs in the same docker container with nginx, serves RESTful JSON-based API and sends system control signals to local nginx process.

2. Provide Jenkins groovy pipelines to automate build and remote deployment (using ssh in this example) of a controller/proxy container and an arbitrary bot container based on response from the controller.

### Usage.
1. Prepare your `tgbot-swarm` host:
```
> sudo groupadd jenkins
> sudo adduser jenkins
> sudo passwd jenkins [password]
> sudo usermod -aG jenkins jenkins
> loginctl enable-linger jenkins
> mkdir /opt/jenkins
> chown jenkins:jenkins jenkins
> chmod 755 jenkins
> yum install docker
> firewall-cmd --add-port=[external-port]/tcp --permanent
```
2. Make your own fork of this repository.
3. Edit `pipeline/infrastructure-dev.conf` according to your host environment.
4. Create plaintext records in Jenkins secret storage:
* `swarm-apikey-dev` = SOME-RANDOM-STRING
* `swarm-hostname-dev` = Domain name of your tgbot host.
* `swarm-sshcred-dev` = SSH password of previously created user Jenkins on the host
* `swarm-tgtoken-dev` = Telegram API key of your bot
5. Edit `pipeline/deploy-controller.jenkinsfile`: set your repo url in the `Checkout Code` stage.
6. Edit `pipeline/deploy-samplebot.jenkinsfile` according to your host environment and set your repo url in the `Checkout Code` stage.
7. Create Jenkins pipelines using `pipeline/deploy-controller.jenkinsfile` and `pipeline/deploy-samplebot.jenkinsfile` from your repo.
8. Run `deploy-controller` and `deploy-samplebot` sequentially.

### API request/response
```
"request": {
    "api-key": "",
    "application-id": "",
    "description": ""
}
```
```
"response": {
    "path": "",
    "port": "",
    "url": "",
    "updated": "",
    "ssl_certificate": "",
    "ssl_key": "",
    "docker_container_name": "",
    "docker_image_name": ""
}
```

### License
check_sateon is licensed under the [MIT](https://www.mit-license.org/) license for all open source applications.

### Bugs and feature requests

Please report bugs [here on Github](https://github.com/xyhtac/check_sateon/issues).
Guidelines for bug reports:
1. Use the GitHub issue search — check if the issue has already been reported.
2. Check if the issue has been fixed — try to reproduce it using the latest master or development branch in the repository.
3. Isolate the problem — create a reduced test case and a live example. 

A good bug report shouldn't leave others needing to chase you up for more information.
Please try to be as detailed as possible in your report.
Feature requests are welcome. Please look for existing ones and use GitHub's "reactions" feature to vote.
