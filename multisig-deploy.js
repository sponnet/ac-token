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

	if (cliOptions.mkwallet) {
		console.log('make wallet');

		var secretSeed = lightwallet.keystore.generateRandomSeed();
		lightwallet.keystore.deriveKeyFromPassword(cliOptions.password, function(err, pwDerivedKey) {

			var keystore = new lightwallet.keystore(secretSeed, pwDerivedKey);
			keystore.generateNewAddress(pwDerivedKey, 15);

			var outputFileName = __dirname + '/' + "mywallet.json";

			if (fs.existsSync(outputFileName)) {
				console.log('file exists - refuse to overwrite...');
			} else {
				console.log('saving to', outputFileName);
				fs.writeFile(outputFileName, keystore.serialize(), 'utf8');
			}

		});

	} else {

		var config = require('./' + cliOptions.config);

		console.log(config);
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

		//Config
		var solidityFile = './contracts/Wallet.sol';
		var contractName = 'Wallet';
		var solcVersion = 'v0.3.1-nightly.2016.4.18+commit.81ae2a7'; //'v0.4.3-nightly.2016.10.24+commit.84b43b91';

		console.log('loading solc...');
		solc.loadRemoteVersion(solcVersion, function(err, solcV) {
			if (err) {
				console.log('Error loading solc', solcV, err);
				process.exit();
			}
			console.log("Solc version:", solcV.version());

			fs.readFile(solidityFile, function(err, result) {
				var source = result.toString();
				console.log('compiling',solidityFile);
				var output = solcV.compile(source, 1); // 1 activates the optimiser
				var abi = JSON.parse(output.contracts[contractName].interface);
				var bytecode = output.contracts[contractName].bytecode;

				// write to 
				var data = {
					bytecode: bytecode,
					abi: abi
				};

				var outputFileName = __dirname + '/' + contractName + ".json";
				console.log('saving compiled contract to', outputFileName);
				fs.writeFile(outputFileName, JSON.stringify(data), 'utf8');


				var contract = web3.eth.contract(abi);

				console.log('contract loaded.')
				console.log('args for new', [
						web3.toHex(config.owner1),
						web3.toHex(config.owner2),
						web3.toHex(config.owner3),
						web3.toHex(config.owner4),
						web3.toHex(config.owner5),
						web3.toHex(config.owner6),
						web3.toHex(config.owner7)
					],
					config.required, config.daily);
				if (cliOptions.send_immediately) {
					console.log('ok - lets go, deploy contract... please wait a few moments');
					contract.new([
							web3.toHex(config.owner1),
							web3.toHex(config.owner2),
							web3.toHex(config.owner3),
							web3.toHex(config.owner4),
							web3.toHex(config.owner5),
							web3.toHex(config.owner6),
							web3.toHex(config.owner7)
						],
						config.required, config.daily, {
							from: config_environment.from,
							gas: 2195665,
							gasPrice: config_environment.gasprice,
							data: bytecode
						},
						function(err, myContract) {
							if (!err) {
								if (myContract.address) {
									console.log('contract deployed');
									console.log('multisig address = ', myContract.address);
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
				}
			});
		});
	}
}