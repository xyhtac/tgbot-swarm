#!/usr/bin/node

// https://github.com/xyhtac/tgbot-swarm
// tgbot-swarm > sample-bot > index.js

// initiate TG bot framework
const TeleBot = require('telebot');

// configure service
const config = require('config');

// link fetch for external api access
const fetch = require('node-fetch');

// load configurations
// binary switch - log non-error information to console
const verbose = config.get('defaults.verbose');

// initiate node.telebot
const bot = new TeleBot({
    token: config.get('telegram.token'),    // Required. Telegram Bot API token.
    webhook: {                              // Optional. Use webhook instead of polling.
        key: config.get('telegram.key'),    // Optional. Private key for server.
        cert: config.get('telegram.cert'),  // Optional. Public key.
        url: config.get('telegram.url'),    // HTTPS url to send updates to.
        host: config.get('telegram.host'),  // Webhook server host.
		port: config.get('telegram.port'),  // Server port.
        maxConnections: config.get('telegram.maxConnections') // Optional. Maximum allowed number of simultaneous HTTPS connections to the webhook for update delivery
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

// get array of filtered strings from the active bot event list
var botEventList = Array.from( bot.eventList.keys() ).map( (x) => { 
	eventName = x.toString().replace(/[^0-9\wа-яА-ЯёЁ\-\_]/gi, '');
	if (!eventName) { return 0 }
	return eventName;
});
// append event array with valid main keyboard values
// botEventList = botEventList.concat( buttonLabels );