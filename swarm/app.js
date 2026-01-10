#!/usr/bin/env node

// https://github.com/xyhtac/tgbot-swarm
// tgbot-swarm > swarm > app.js


const Docker = require('dockerode');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const docker = new Docker({ socketPath: '/tmp/docker.sock' });

// --- Configurable paths ---
const NGX_CONFIG_FILE = process.env.NGINX_CONFIG_FILE || '/etc/nginx/conf.d/endpoints.conf';
const NGX_RELOAD_CMD = process.env.NGINX_RELOAD_CMD || 'nginx -s reload';
const VERBOSE = process.env.VERBOSE === 'true';
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000');

// In-memory registry of containers
let containerMapping = {};

// Utility logging
function log(...args) {
  if (VERBOSE) console.log('[CONTROLLER]', ...args);
}

// --- Generate nginx config ---
function generateNginxConfig(mapping) {
  return Object.entries(mapping)
    .map(([swarmPath, info]) => `
location /${swarmPath}/ {
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_ssl_verify off;
	  proxy_ssl_session_reuse off;
	  proxy_ssl_server_name on;
	  proxy_ssl_name $host;

    proxy_pass https://${info.ip}:${info.port}/${swarmPath}/;
}
`).join('\n');
}

// --- Write nginx config and reload ---
function applyNginxConfig(mapping) {
  const configContent = generateNginxConfig(mapping);
  try {
    fs.writeFileSync(NGX_CONFIG_FILE, configContent, 'utf8');
    log(`Nginx config written to ${NGX_CONFIG_FILE}`);
  } catch (err) {
    console.error('[ERROR] Failed to write nginx config:', err);
    return;
  }

  const [cmd, ...args] = NGX_RELOAD_CMD.split(' ');
  const child = spawn(cmd, args, { stdio: 'inherit' });
  child.on('exit', code => {
    if (code === 0) log('Nginx reload successful');
    else console.error('[ERROR] Nginx reload failed with code', code);
  });
}

// --- Inspect container environment and network ---
async function inspectContainer(containerId) {
  const container = docker.getContainer(containerId);
  try {
    const data = await container.inspect();

    const env = {};
    (data.Config.Env || []).forEach(e => {
      const [key, val] = e.split('=');
      env[key] = val;
    });

    const swarmPath = env.SWARM_PATH;
    const swarmPort = env.SWARM_PORT;

    if (!swarmPath || !swarmPort) return null;

    // Use container's internal IP from the first network
    const networks = Object.values(data.NetworkSettings.Networks || {});
    const ip = networks[0]?.IPAddress || data.NetworkSettings.IPAddress;

    if (!ip) return null;

    return { path: swarmPath, port: swarmPort, ip };
  } catch (err) {
    console.error('[ERROR] Failed to inspect container', containerId, err);
    return null;
  }
}

// --- Rebuild the in-memory registry from all containers ---
async function rebuildMapping() {
  const containers = await docker.listContainers({ all: false });
  const newMapping = {};

  for (const c of containers) {
    const info = await inspectContainer(c.Id);
    if (!info) continue;

    // Last-is-best: overwrite previous mapping for same path
    newMapping[info.path] = {
      ip: info.ip,
      port: info.port,
      containerId: c.Id
    };
  }

  containerMapping = newMapping;
  applyNginxConfig(containerMapping);
}

// --- Subscribe to docker events for real-time updates ---
function subscribeDockerEvents() {
  docker.getEvents({ filters: { type: ['container'] } }, (err, stream) => {
    if (err) return console.error('[ERROR] Docker event subscription failed:', err);
    log('Subscribed to Docker events');

    let buffer = '';
    stream.on('data', chunk => {
      buffer += chunk.toString();
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        if (!line) continue;

        try {
          const event = JSON.parse(line);
          if (['start', 'stop', 'die', 'destroy'].includes(event.status)) {
            log('Docker event detected:', event.status, event.id);
            rebuildMapping(); // rebuild mapping on container lifecycle change
          }
        } catch (e) {
          console.error('[ERROR] Failed to parse docker event line', e);
        }
      }
    });
  });
}

// --- Periodic reconciliation (backup if events fail) ---
setInterval(rebuildMapping, POLL_INTERVAL_MS);

// --- Initial reconciliation ---
(async () => {
  log('Controller starting, building initial mapping...');
  await rebuildMapping();
  subscribeDockerEvents();
})();
