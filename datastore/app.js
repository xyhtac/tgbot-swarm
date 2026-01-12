const Docker = require('dockerode');
const mysql = require('mysql2/promise');

const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/tmp/docker.sock';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD;
const VERBOSE = (process.env.VERBOSE || 'false').toLowerCase() === 'true';

const docker = new Docker({ socketPath: DOCKER_SOCKET });
const dbMap = new Map();

async function getRootConnection() {
    return mysql.createConnection({
        host: '127.0.0.1',
        port: DB_PORT,
        user: 'root',
        password: MYSQL_ROOT_PASSWORD,
        multipleStatements: true
    });
}

async function applyDbConfig(dbName, dbPass) {
    const conn = await getRootConnection();
    try {
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
        await conn.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?`, [dbName, dbPass]);
        await conn.query(`ALTER USER ?@'%' IDENTIFIED BY ?`, [dbName, dbPass]);
        await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ?@'%'`, [dbName]);
        await conn.query('FLUSH PRIVILEGES');
        if (VERBOSE) console.log(`[DB] Applied config: ${dbName}`);
    } finally {
        await conn.end();
    }
}

async function handleContainerEvent(event) {
    try {
        const container = docker.getContainer(event.id);
        const info = await container.inspect();
        const env = info.Config.Env || [];
        const envObj = Object.fromEntries(env.map(e => e.split('=')));

        const dbName = envObj.SWARM_DB_STORE;
        const dbPass = envObj.SWARM_DB_PASS;

        if (!dbName || !dbPass) return;

        dbMap.set(dbName, dbPass);
        await applyDbConfig(dbName, dbPass);
    } catch (err) {
        console.error('[ERROR] Docker event handler:', err.message);
    }
}

// Subscribe to Docker events
docker.getEvents({}, (err, stream) => {
    if (err) throw err;
    stream.on('data', chunk => {
        const event = JSON.parse(chunk.toString('utf8'));
        if (['start', 'die', 'destroy'].includes(event.status)) handleContainerEvent(event);
    });
});

// Apply config for existing containers on startup
(async () => {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) await handleContainerEvent({ id: c.Id, status: 'start' });
    console.log('[INIT] Controller ready, monitoring docker.sock for DB changes');
})();
