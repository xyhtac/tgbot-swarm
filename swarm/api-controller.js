#!/usr/bin/node

// https://github.com/xyhtac/tgbot-swarm
// tgbot-swarm > swarm > api-controller.js

// initiate express server
const express = require('express');
const app = express();

// initiate filesystem access
const fs = require('fs');

// required to load preferences from JSON config files
const config = require('config');

// link crypto library
const crypto = require('crypto');

// link system exec library
var cmd = require('node-cmd');

// load configurations
// load controller configuration
const controller = config.get('controller');
// load proxy configuration
const proxy = config.get('proxy');
// load api structure
const api = config.get('api');

// load default constants
// load log verbosity switch
const verbose = config.get('defaults.verbose');
// load log verbosity switch
const portRange = config.get('defaults.portrange');
// load payload configuration filename
const payloadsFilename = config.get('defaults.payloads');
// load SSL certificate filename
const certificateFilename = config.get('defaults.certificate');
// load SSL key filename
const sslKeyFilename = config.get('defaults.sslkey');
// load nginx configuration filename
const nginxConfigFilename = config.get('defaults.nginxconfig');
// load nginx reconfigure command
const nginxReloadCommand = config.get('defaults.proxycmd')

// initiate payload configuration object from file
var payloadNodes = readPayloadConfiguration( payloadsFilename );
const SSLCertificate = readStaticFile( certificateFilename );
const SSLKey = readStaticFile( sslKeyFilename );

// write on-startup nginx configuration
writeStaticFile ( nginxConfigFilename, generateNginxConfig ( payloadNodes ) );

app.get("/update", async function (req, res) {
	if ( req.query["api-key"] != api.key ) {
		res.send({
			'status' : 'API key mismatch. '
		});
		return (1);
	};

	let updateTime = getDatetime().toString();
	let nodeNames = Object.keys( payloadNodes );
	let floatPort = portRange[0];
	let appPath; let appUrl; let appName; let appDescription; let nodePort;

	// iterate trough existing nodes to make sure that ports are within range and 
	// find maximum used port number
	for (let nodeCount in nodeNames ) {
		appName = nodeNames[nodeCount];
		nodePort = Number( payloadNodes [ appName ]["port"]);
		
		if (nodePort > floatPort) {
			floatPort = nodePort;
		}

		if (floatPort > portRange[1]) {
			if (verbose) { console.log("Port range exceeded") };
			return (1);
		}

		// make action if nodePort is out of range
		if ( nodePort < Number( portRange[0] ) || nodePort > Number (portRange[1]) ) {
			// increment floatPort and nudge current nodePort its threshold
			floatPort++;
			nodePort = floatPort;

			// update app data according to the new port number
			appPath = makeHashString( appName, nodePort );
			appUrl = "https://" + proxy.fqdn + ":" + proxy.port + "/" + appPath;
			payloadNodes [ appName ]["path"] = appPath;
			payloadNodes [ appName ]["port"] = nodePort;
			payloadNodes [ appName ]["url"] = appUrl;
			payloadNodes [ appName ]["updated"] = updateTime;
		};

	}

	let requestedName = req.query["application-id"];
	let requestedDescription = req.query["description"];

	try {
		requestedName.replace(/[^a-zA-Z\-]/gm,"");
	} catch(error) {
		if (verbose) { console.log("Variable assinment fault: " + error) }
	}
	if ( !requestedName ) {
		res.send({
			'status' : 'Invalid application name provided. '
		});
		return (1);
	}

	try {
		requestedDescription.replace(/[^a-zA-Z\-]/gm,"");
	} catch(error) {
		if (verbose) { console.log("Variable assignment fault: " + error) }
	}
	if ( !requestedDescription ) {
		requestedDescription = "New application " + requestedName;
	}

	if ( payloadNodes[ requestedName ] ) {
		// update description and updatetime if node exists
		payloadNodes[ requestedName ]["description"] = appDescription;
		payloadNodes[ requestedName ]["updated"] = updateTime;
	} else {
		// create new node if appName key does not exist in payloadNodes object
		appPath = makeHashString( requestedName, floatPort );
		appUrl = "https://" + proxy.fqdn + ":" + proxy.port + "/" + appPath;
		nodePort = floatPort + 1;
		payloadNodes[ requestedName ] = {
			"description": appDescription,
			"docker_image_name": requestedName + "-image",
			"docker_container_name": requestedName + "-app",
			"path": appPath,
			"port": nodePort,
			"url": appUrl,
			"updated": updateTime
		};
	}

	writePayloadConfiguration ( payloadsFilename, payloadNodes );
	writeStaticFile ( nginxConfigFilename, generateNginxConfig ( payloadNodes ) );

	cmd.runSync( nginxReloadCommand, function(err, data, stderr) {
            console.log('Reload command exec result:  : ', data);
    });

	// create empty apiRespoonse and assign params to it
	let apiResponse = {};
	Object.assign( apiResponse, payloadNodes[ requestedName ] )
	apiResponse["ssl_certificate"] = SSLCertificate;
	apiResponse["ssl_key"] = SSLKey;

	res.send( apiResponse );
	return (0);
});

// initiate web server
app.listen( controller.port );

// print diagnostic data to console
console.log('Server started at http://' + controller.host + ':' + controller.port); 

function generateNginxConfig ( configObject ) {
	let nodeNames = Object.keys( configObject );
	let configContent = "";
	for (let nodeCount in nodeNames ) {
		appName = nodeNames[ nodeCount ];
		let nodePath = configObject [ appName ]["path"] ;
		let nodePort = configObject [ appName ]["port"] ;

		let fqdn = proxy.fqdn;
		let proxyHost = proxy.host;
		
		configContent += `\
		location /${nodePath}/ { \n \
			proxy_ssl_verify        off; \n \
			proxy_ssl_session_reuse off; \n \
			proxy_ssl_server_name   on; \n \
			proxy_ssl_name          ${fqdn}; \n \
			proxy_set_header Host   ${fqdn}; \n \
			proxy_pass https://${proxyHost}:${nodePort}/${nodePath}/; \n \
		}\n\n`;
	}
	return (configContent);
}

function readStaticFile( staticFilename ) {
	let rawContents;
	try {
		rawContents = fs.readFileSync( staticFilename, 'utf8' );
	} catch(error) {
		if (verbose) { console.log ("Could not read static file." + error) };
		return (1);
	}
	return (rawContents);
}

function writeStaticFile( staticFilename, rawContents ) {
	try {
		fs.writeFileSync( staticFilename, rawContents, 'utf8' );
		if (verbose) { console.log ("Static file has been written") };
		return(0);
	} catch(error) {
		if (verbose) { console.log ("Could not write to static file." + error) };
		return (1);
	}
}

function readPayloadConfiguration( configFilename ) {
	if (!fs.existsSync(configFilename)) { 
		if (verbose) { console.log ("JSON configuration file does not exist") };
		return (1);
	}
	let rawContents = fs.readFileSync( configFilename );
	try {
		payloadsObject = JSON.parse(rawContents);
	} catch (error) {
		if (verbose) { console.log ("Could not parse config in JSON format." + error) };
		return (1);
	}
	return payloadsObject;
}


function writePayloadConfiguration ( configFilename, payloadsObject ) {
	let rawContents = JSON.stringify(payloadsObject, null, 2);
	try {
		fs.writeFileSync(configFilename, rawContents, 'utf8');
		if (verbose) { console.log ("JSON configuration has been written") };
		return(0);
	} catch (error) {
		if (verbose) { console.log ("Error writing to file: " + configFilename + " - " + error) };
		return (1);
	}
}

function makeHashString ( appName, nodePort ) {
	var dpo = new Date();
	curtime = ( dpo.getMonth() + 1 ) + "-" + dpo.getDate() + "-" + dpo.getHours() + "-" + Math.round( dpo.getMinutes() / 5 );
	hashString = appName + "-" + nodePort + "-" + curtime;
	let hashval = crypto.createHash('md5').update( hashString ).digest("hex");
	return hashval;
}

function getDatetime () {
	var currentdate = new Date();
	var dateparts = Array();
	var n = 0;
	dps = [currentdate.getDate(), (currentdate.getMonth()+1), currentdate.getFullYear(), currentdate.getHours(), currentdate.getMinutes(), currentdate.getSeconds()];
	for (dp of dps) {
		if (dp < 10) {dp = "0" + dp };
		dateparts[n] = dp;
		n++;
	}
	var datetime = dateparts[0] + "."
			+ dateparts[1] + "." 
			+ dateparts[2] + " "  
			+ dateparts[3] + ":"  
			+ dateparts[4] + ":" 
			+ dateparts[5];
	return (datetime);
}




