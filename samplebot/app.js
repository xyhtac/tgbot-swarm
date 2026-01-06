#!/usr/bin/node

// https://github.com/xyhtac/tgbot-swarm
// tgbot-swarm > sample-bot > index.js
// v.2: Updated to use environment variables instead of config files


// Load configuration from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;                        // Bot API token
const HOSTNAME = process.env.HOSTNAME;                          // Fully-qualified domain name for webhook (inlcude port if !=443)
const SWARM_PATH = process.env.SWARM_PATH;                      // Requested Path for tgbot-swarm
const SWARM_PORT = parseNumber(process.env.SWARM_PORT);         // Requested Port for tgbot-swarm
const SSL_KEY  = process.env.SSL_KEY  || '/app/ssl.key';        // SSL Key local filename with fallback
const SSL_CERT = process.env.SSL_CERT || '/app/ssl.pem';        // SSL Certificate local filename with fallback

// Verify required values
if (!BOT_TOKEN || isNaN(SWARM_PORT) ) {
    console.error('[FATAL] Required params not set in environment.');
    process.exit(1);
}

// initiate TG bot framework
const TeleBot = require('telebot');

// configure service
const config = require('config');

// link fetch for external api access
const fetch = require('node-fetch');

// load configurations
// binary switch - log non-error information to console
let verbose =
    process.env.VERBOSE !== undefined
        ? parseBool(process.env.VERBOSE, false)
        : (config.has('defaults.verbose') ? config.get('defaults.verbose') : false);

// Compose webhook URL
const WEBHOOK_URL = `https://${HOSTNAME}/${SWARM_PATH}`;


// initiate node.telebot
const bot = new TeleBot({
    token: BOT_TOKEN,    // Required. Telegram Bot API token.
    webhook: {                              // Optional. Use webhook instead of polling.
        key: SSL_KEY,                       // Optional. Private key for server.
        cert: SSL_CERT,                     // Optional. Public key.
        url: WEBHOOK_URL,                   // HTTPS url to send updates to.
        host: '172.17.0.9',                    // Webhook server host.
		port: SWARM_PORT,                   // Server port.
        maxConnections: 30                  //config.get('telegram.maxConnections') // Optional. Maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery
    },
    allowedUpdates: [], // Optional. List the types of updates you want your bot to receive. Specify an empty list to receive all updates.
    usePlugins: ['askUser', 'commandButton', 'namedButtons'], // Optional. Use user plugins from pluginFolder.
    pluginFolder: '../plugins/' // Optional. Plugin folder location.
    /*
    pluginConfig: { // Optional. Plugin configuration.
        namedButtons: {
            buttons: buttonSet
        }
    }
    */
});


bot.on('/start', msg => {
    let parseMode = 'html';
    let replyMarkup = {};
    message = "This is a sample Telegram bot webhook handler";
    if ( verbose ) { console.log("start command received") };
    return bot.sendMessage( msg.from.id, message, {replyMarkup, parseMode} );
});

// start service
bot.start();
console.log(`Setting up server on port ${SWARM_PORT}`)
if  ( verbose ) {  };

// get array of filtered strings from the active bot event list
var botEventList = Array.from( bot.eventList.keys() ).map( (x) => { 
	eventName = x.toString().replace(/[^0-9\wа-яА-ЯёЁ\-\_]/gi, '');
	if (!eventName) { return 0 }
	return eventName;
});
// append event array with valid main keyboard values
// botEventList = botEventList.concat( buttonLabels );



// Helper function to parse boolean from ENV
function parseBool(value, defaultValue = false) {
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
}

// Helper function to parse number from ENV
function parseNumber(value, defaultValue) {
    const n = Number(value);
    return isNaN(n) ? defaultValue : n;
}