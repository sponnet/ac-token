var Web3 = require('web3');
var solc = require('solc');
var fs = require('fs');
var async = require('async');
var ethabi = require('ethereumjs-abi');
var commandLineArgs = require('command-line-args');
var config_environment = require('./environment.json');
var HookedWeb3Provider = require("hooked-web3-provider");
var lightwallet = require('eth-lightwallet');

var cli = commandLineArgs([{
	name: 'help',
	alias: 'h',
	type: Boolean
}, {
	name: 'config',
	alias: 'c',
	type: String
}, {
	name: 'password',
	alias: 'p',
	type: String
}, {
	name: 'mkwallet',
	type: Boolean,
	defaultValue: false
}, {
	name: 'send_immediately',
	type: Boolean,
	defaultValue: false
}, ]);
var cliOptions = cli.parse();

if (cliOptions.help) {
	console.log(cli.getUsage());
} else {

	if (!cliOptions.config) {
		console.log('need config file!');
		console.log(cli.getUsage());
	}

	if (!cliOptions.password) {
		console.log('need password !');
		console.log(cli.getUsage());
	}



	console.log('deploying to' + config_environment.hostname);

	var web3 = new Web3();

	var walletdata = JSON.stringify(require(config_environment.walletfile));

	var keystore = new lightwallet.keystore.deserialize(walletdata);

	keystore.passwordProvider = function(callback) {
		console.log('signing tx');
		callback(null, cliOptions.password);
	};

	var provider = new HookedWeb3Provider({
		host: config_environment.hostname,
		transaction_signer: keystore
	});

	web3.setProvider(provider);

	config_environment.from = keystore.getAddresses()[0];

	console.log('wallet address=', keystore.getAddresses());
	console.log('deploy address=', config_environment.from);

	var ARCcontract = require('./ARCToken.json');

	var contract = web3.eth.contract(ARCcontract.abi);
	var instance = contract.at(ARCcontract.address);

	console.log('ARCtoken at',ARCcontract.address);

	console.log('at block:',web3.eth.blockNumber);


	if (cliOptions.send_immediately) {

	
		instance.allocateTokens.sendTransaction({
				from: config_environment.from,
				gas: 2500000
			},
			function(err, tx) {
				if (err) {
					console.log(err);
				}
				console.log('setRewardAddresses TX=', tx);
			}
		);

	} else {
		console.log('not deploying now, set --send_immediately to send transaction');
	}


}