## Abstract.
Telegram API bot handler is arguably the least complex and resource-hungry backend application a developer can build. Some make tens of them for specific tasks without the need of maintanance and regular update. Telegram offers webhook API updates to push data to the handler application in the JSON fromat, which requires running publicly available https server on one of valid ports (80, 443, 88 or 8443) with self-signed or CA-signed certificate. A frugal build-and-forget methodology is oftentimes preferred to avoid the costs of using fancy off-site CI/CD platforms and no-code services. Popular and well-maintained opensource bot libraries widely used by developers usually serve only one bot token per process.

## The problem.
Running multiple instances of dockerized bot applications on a single host considering network resource optimization and a limited number of allowed ports requires using nginx reverse proxy to take care of connection dispacth. Configuration of nginx has to be carefully maintained in regards with actual port settings of docker containers; nginx certificates also have to be consistent with all deployed bot applications. No external container orchestartion and no nginx control API are allowed by the conditions of our task. Therefore, the amount of manwork required to set-up and maintain single-host multi-bot dockerized infrastructure is significantly higher then the development process of the bot itself.

## The solution.
To minimize our efforts in bot hosting deployment tgbot-swarm solves two major sets of tasks:

1. Provide a built-in API that employs port, path and SSL-certificate assignment mechanism and a relevant proxy config generation. In a nutshell it is a controller node.js express application that runs in the same docker container with nginx, receives web calls as JSON and sends control signals to nginx.

2. Provide Jenkins groovy pipelines to automate bulid and remote ssh deployment of a controller/proxy container and a bot container using data retrieved from controller.

## API request/response

