#!/usr/bin/env node

const Docker = require('dockerode');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// ---- ENV & STATE ----
const STATE_FILE = '/app/state/.env';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const VERBOSE = (process.env.VERBOSE || '0') === '1';
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/tmp/docker.sock';

// Load MYSQL_ROOT_PASSWORD from ENV or state file
let MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD;
if (!MYSQL_ROOT_PASSWORD && fs.existsSync(STATE_FILE)) {
    const lines = fs.readFileSync(STATE_FILE, 'utf8').split('\n');
    for (const line of lines) {
        const [k, v] = line.split('=', 2);
        if (k === 'MYSQL_ROOT_PASSWORD') MYSQL_ROOT_PASSWORD = v;
    }
}

if (!MYSQL_ROOT_PASSWORD) {
    console.error('[FATAL] MYSQL_ROOT_PASSWORD is not set!');
    process.exit(1);
}

// Docker client
const docker = new Docker({ socketPath: DOCKER_SOCKET });

// Logging helper
function log(...args) {
    if (VERBOSE) console.log('[DBCTL]', ...args);
}

// ---- FILTER FUNCTION ----
function filterSQLVar(val) {
    if (typeof val !== 'string') return '';
    return val.replace(/[^a-zA-Z0-9_\-]/g, '');
}

// ---- DB CONNECTION ----
async function getDb() {
    return mysql.createConnection({
        host: '127.0.0.1',
        port: DB_PORT,
        user: 'root',
        password: MYSQL_ROOT_PASSWORD,
        multipleStatements: true
    });
}

// ---- RECONCILE FUNCTION ----
async function reconcile(store, pass) {
    store = filterSQLVar(store);
    pass = String(pass); // allow any characters in password

    log(`Reconciling DB: ${store}`);

    const conn = await getDb();

    try {
        // Create DB if not exists
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${store}\`;`);

        // Create/alter user with all-host wildcard
        await conn.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?;`, [store, pass]);
        await conn.query(`ALTER USER ?@'%' IDENTIFIED BY ?;`, [store, pass]);

        // Grant privileges
        await conn.query(`GRANT ALL PRIVILEGES ON \`${store}\`.* TO ?@'%';`, [store]);
        await conn.query(`FLUSH PRIVILEGES;`);

        log(`DB and user ready: ${store}@%`);
    } catch (err) {
        console.error('[ERROR] Reconcile failed:', err.message);
    } finally {
        await conn.end();
    }
}

// ---- HANDLE CONTAINER EVENT ----
async function handleContainer(containerId) {
    try {
        const container = docker.getContainer(containerId);
        const info = await container.inspect();

        const env = Object.fromEntries(
            (info.Config.Env || []).map(e => e.split('=', 2))
        );

        if (!env.SWARM_DB_STORE || !env.SWARM_DB_PASS) return;

        await reconcile(env.SWARM_DB_STORE, env.SWARM_DB_PASS);
    } catch (err) {
        console.error('[ERROR] Container handling failed:', err.message);
    }
}

// ---- INITIAL SCAN ----
async function scanExisting() {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
        await handleContainer(c.Id);
    }
}

// ---- DOCKER EVENTS ----
docker.getEvents({}, (err, stream) => {
    if (err) {
        console.error('[FATAL] Docker events failed:', err.message);
        process.exit(1);
    }

    stream.on('data', async buf => {
        try {
            const evt = JSON.parse(buf.toString());
            if (evt.Type === 'container' && ['start', 'update'].includes(evt.Action)) {
                await handleContainer(evt.id);
            }
        } catch (_) {}
    });
});

// Start initial scan
scanExisting();
