### Abstract.
Telegram API bot handler is arguably the least complex and resource-hungry backend application a developer can build. Some make tens of them for specific tasks without the need of maintanance and regular update. Telegram offers webhook API updates to push data to the handler application in the JSON fromat, which requires running publicly available https server on one of valid ports (80, 443, 88 or 8443) with self-signed or CA-signed certificate. A frugal build-and-forget methodology is oftentimes preferred to avoid the costs of using fancy off-site CI/CD platforms and no-code services. Popular and well-maintained opensource bot libraries widely used by developers usually serve only one bot token per process.

### Problem.
Running multiple instances of dockerized bot applications on a single host considering network resource optimization and a limited number of allowed ports requires using nginx reverse proxy to take care of connection dispacth. Configuration of nginx has to be carefully maintained in regards with actual port settings of docker containers; nginx certificates also have to be consistent with all deployed bot applications. No external container orchestartion and no nginx control API are allowed by the conditions of our task. Therefore, the amount of manwork required to set-up and maintain single-host multi-bot dockerized infrastructure is significantly higher then the development process of the bot itself.

### Solution.
To minimize our efforts in bot hosting deployment `tgbot-swarm`` solves two scopes of tasks:

1. Provide a built-in API that employs port, path and SSL-certificate assignment mechanism and a relevant proxy config generation. In a nutshell it is a node.js controller express application that runs in the same docker container with nginx, receives web calls as JSON and sends control signals to nginx.

2. Provide Jenkins groovy pipelines to automate bulid and remote deployment (using ssh in the sample) of a controller/proxy container and an arbitrary bot container based on response from controller.

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
    "host": "",
    "port": "",
    "url": "",
    "ssl_certificate": "",
    "ssl_key": "",
    "container_name": "",
    "image_name": ""
}
```
