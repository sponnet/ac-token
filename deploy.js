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

	if (!cliOptions.config) {
		console.log('need config file!');
		console.log(cli.getUsage());
	}

	var config = require('./' + cliOptions.config);

	console.log(config);

	// either the endblock or the duration is specified.
	config.end_block = config.end_block || config.start_block + config.duration;

	var web3 = new Web3();
	web3.setProvider(new web3.providers.HttpProvider(config_environment.hostname));

	//Config
	var solidityFile = './contracts/ARCToken.sol';
	var contractName = 'ARCToken';
	var solcVersion = 'v0.4.3-nightly.2016.10.24+commit.84b43b91';

	//var multisig = config.multisig;

	var constructTypes = ["address", "uint256", "uint256"];
	var constructArguments = [config.multisig, config.start_block, config.end_block];

	solc.loadRemoteVersion(solcVersion, function(err, solcV) {
		if (err) {
			console.log('Error loading solc', solcV, err);
			process.exit();
		}
		console.log("Solc version:", solcV.version());

		var abiEncoded = ethabi.rawEncode(constructTypes, constructArguments);
		console.log('ABI encoded constructor arguments: ' + abiEncoded.toString('hex'));

		fs.readFile(solidityFile, function(err, result) {
			var source = result.toString();
			var output = solcV.compile(source, 1); // 1 activates the optimiser
			var abi = JSON.parse(output.contracts[contractName].interface);
			var bytecode = output.contracts[contractName].bytecode;

			var contract = web3.eth.contract(abi);

			var data = {
				bytecode: bytecode,
				abi: abi,
			};

			var outputFileName = __dirname + '/' + contractName + ".json";
			console.log('saving to', outputFileName);
			fs.writeFile(outputFileName, JSON.stringify(data), 'utf8');


			if (cliOptions.send_immediately) {
				console.log('deploying', contractName, "startblock", config.start_block, "endblock", config.end_block);
				contract.new(config.multisig, config.start_block, config.end_block, {
					from: config_environment.from,
					gas: 3500000,
					data: bytecode
				}, function(err, myContract) {
					if (!err) {
						if (myContract.address) {
							console.log('ARC Token address', myContract.address);

							var data = {
								bytecode: bytecode,
								abi: abi,
								address: myContract.address
							};

							var outputFileName = __dirname + '/' + contractName + ".json";
							console.log('saving to', outputFileName);
							fs.writeFile(outputFileName, JSON.stringify(data), 'utf8');

						}
					} else {
						console.log(err);
					}
				});
			} else {
				console.log('not deploying now, set --send_immediately to send transaction');
				// var data = contract.new.getData(multisig, config.start_block, config.end_block, {
				// 	data: bytecode
				// });
				// console.log(data);
			}
		});
	});
}