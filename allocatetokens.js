var Web3 = require('web3');
var solc = require('solc');
var fs = require('fs');
var async = require('async');
var ethabi = require('ethereumjs-abi');
var commandLineArgs = require('command-line-args');
var config_environment = require('./environment.json');

var cli = commandLineArgs([{
	name: 'help',
	alias: 'h',
	type: Boolean
}, {
	name: 'config',
	alias: 'c',
	type: String
}, {
	name: 'send_immediately',
	type: Boolean,
	defaultValue: false
}, ]);
var cliOptions = cli.parse();

if (cliOptions.help) {
	console.log(cli.getUsage());
} else {
	
	var web3 = new Web3();
	web3.setProvider(new web3.providers.HttpProvider(config_environment.hostname));

	//Config
	var solidityFile = './contracts/ARCToken.sol';
	var contractName = 'ARCToken';
	var solcVersion = 'v0.4.3-nightly.2016.10.24+commit.84b43b91';

	var coinContract = require('./ARCToken.json');

	solc.loadRemoteVersion(solcVersion, function(err, solcV) {
		if (err) {
			console.log('Error loading solc', solcV, err);
			process.exit();
		}
		console.log("Solc version:", solcV.version());

		// var abiEncoded = ethabi.rawEncode(constructTypes, constructArguments);
		// console.log('ABI encoded constructor arguments: ' + abiEncoded.toString('hex'));

		fs.readFile(solidityFile, function(err, result) {
			var source = result.toString();
			var output = solcV.compile(source, 1); // 1 activates the optimiser
			var abi = JSON.parse(output.contracts[contractName].interface);
			var bytecode = output.contracts[contractName].bytecode;

			var contract = web3.eth.contract(abi);

			if (cliOptions.send_immediately) {
				
				var instance = contract.at(coinContract.address);
				instance.allocateTokens.sendTransaction({
						from: config_environment.from,
						gas: 3500000,
						gasprice: config_environment.gasprice
					},
					function(err,tx) {
						if (err){
							console.log(err);
						}
						console.log('setRewardAddresses TX=', tx);
					}
				);
					
			} else {
				console.log('not deploying now, set --send_immediately to send transaction');
			
			}
		});
	});
}