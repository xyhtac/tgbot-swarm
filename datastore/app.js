const Docker = require('dockerode');
const mysql = require('mysql2/promise');


const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/tmp/docker.sock';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD;
const VERBOSE = (process.env.VERBOSE || 'false').toLowerCase() === 'true';

const docker = new Docker({ socketPath: DOCKER_SOCKET });


if (!MYSQL_ROOT_PASSWORD) {
    console.error('[FATAL] MYSQL_ROOT_PASSWORD is required');
    process.exit(1);
}

function log(...args) {
    if (VERBOSE) console.log('[DBCTL]', ...args);
}

async function getDb() {
    return mysql.createConnection({
        host: '127.0.0.1',
        port: DB_PORT,
        user: 'root',
        password: MYSQL_ROOT_PASSWORD,
        multipleStatements: true
    });
}

async function reconcile(store, pass) {
    log(`Reconciling DB: ${store}`);

    const conn = await getDb(); // assumes getDb() returns a mysql2/promise connection

    try {
        // Create database if it doesn't exist
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${store}\`;`);

        // Create user if it doesn't exist, then update password
        await conn.query(`CREATE USER IF NOT EXISTS ?@'%' IDENTIFIED BY ?;`, [store, pass]);
        await conn.query(`ALTER USER ?@'%' IDENTIFIED BY ?;`, [store, pass]);

        // Grant privileges on the database
        await conn.query(`GRANT ALL PRIVILEGES ON \`${store}\`.* TO ?@'%';`, [store]);

        // Apply changes immediately
        await conn.query(`FLUSH PRIVILEGES;`);

        log(`DB and user ready: ${store}@%`);
    } catch (err) {
        log(`Error reconciling DB ${store}: ${err.message}`);
        throw err;
    } finally {
        await conn.end();
    }
}

/*
async function reconcile(store, pass) {
    log(`Reconciling DB=${store}`);

    const conn = await getDb();

    await conn.query(`
        CREATE DATABASE IF NOT EXISTS \`${store}\`;
        CREATE USER IF NOT EXISTS '${store}'@'%' IDENTIFIED BY '${pass}';
        ALTER USER '${store}'@'%' IDENTIFIED BY '${pass}';
        GRANT ALL PRIVILEGES ON \`${store}\`.* TO '${store}'@'%';
        FLUSH PRIVILEGES;
    `);

    await conn.end();
    log(`DB ready: ${store}`);
}
*/

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
        console.error('[ERROR]', err.message);
    }
}

// Initial scan
async function scanExisting() {
    const containers = await docker.listContainers({ all: true });
    for (const c of containers) {
        await handleContainer(c.Id);
    }
}

// Docker events
docker.getEvents({}, (err, stream) => {
    if (err) {
        console.error('[FATAL] Docker events failed:', err);
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

scanExisting();
