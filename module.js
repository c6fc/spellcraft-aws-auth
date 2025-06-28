'use strict';

/**
 * @module spellcraft-aws-auth-cli
 * @description This module represents the set of CLI commands provided by the
 * SpellCraft plugin. These commands are added to the main
 * `spellcraft` CLI when the integration module is imported and active.
 */

process.env.AWS_SDK_JS_SUPPRESS_MAINTENANCE_MODE_MESSAGE=1

const fs = require("fs");
const os = require("os");
const aws = require("aws-sdk");
const ini = require("ini");
const path = require("path");
const readline = require("readline");

exports._spellcraft_metadata = {
	functionContext: { aws },
	cliExtensions: (yargs, spellframe) => {
		yargs
			.command("aws-identity", "Display the AWS IAM identity of the SpellCraft execution context", (yargs) => yargs, async (argv) => {

				await spellframe.init();
				await setAwsCredentials();
				console.log(await verifyCredentials());

			})
			.command("aws-exportcredentials", "Export the current credentials as environment variables", (yargs) => yargs, async (argv) => {

				await spellframe.init();
				await verifyCredentials();
				exportCredentials();

			});

		console.log(`[+] Imported SpellFrame CLI extensions for @c6fc/spellcraft-aws-auth`);
	},
	init: async () => {
		setAwsCredentials();
	}
}

exports.aws = [async function (clientObj, method, params) {
		clientObj = JSON.parse(clientObj);
		const client = new aws[clientObj.service](clientObj.params);
		return client[method](JSON.parse(params)).promise();
	}, "clientObj", "method", "params"];

async function exportCredentials() {
	await verifyCredentials();
	['AWS_PROFILE', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'].map(e => {
		if (process.env?.[e]) {
			console.log(`export ${e}=${process.env[e]}`);
		}
	});
}

async function setAwsCredentials() {

	let valid;
	let profile = process.env.AWS_PROFILE;

	if (!profile) {

		let caller = await verifyCredentials();
		if (!!caller) {

			if (!!process.env.SPELLCRAFT_ASSUMEROLE) {
				caller = await processRoleChain();
			}

			console.log(`[+] Authenticated as ${caller.Arn ?? caller.arn}`);
			return caller;
		}

		console.log(`[!] No profile was specified, and the default credential context is invalid.`);

		process.exit(1);
	}

	delete process.env.AWS_PROFILE;
	delete process.env.AWS_ACCESS_KEY_ID;
	delete process.env.AWS_SECRET_ACCESS_KEY;
	delete process.env.AWS_SESSION_TOKEN;

	if (!fs.existsSync(`${os.homedir()}/.aws/credentials`)) {
		console.log("[!] The default credential file is missing. Have you configured the AWS CLI yet?");
		process.exit(1);
	}

	const credfile = ini.parse(fs.readFileSync(`${os.homedir()}/.aws/credentials`, 'utf-8'));

	if (!credfile[profile]) {
		throw new Error(`AWS Profile [${profile}] isn't set.`);
	}

	const creds = credfile[profile];
	const cacheFile = `${os.homedir()}/.aws/profile_cache.json`;

	// Initialize and test the cache before trying anything else.
	let cache;

	if (fs.existsSync(cacheFile)) {
		try {

			cache = JSON.parse(fs.readFileSync(cacheFile));

			if (!!cache.expireTime && (!!!process.env.SPELLCRAFT_ASSUMEROLE && cache.profile == profile) || cache.profile == process.env.SPELLCRAFT_ASSUMEROLE) {
				if (cache.expireTime > Date.now() + 2700000) {

					aws.config.update({
						credentials: cache
					});

					valid = await verifyCredentials();

					if (!valid) {
						throw new Error("AWS credential cache verification error");
					}

					process.env.AWS_PROFILE = '';
					process.env.AWS_ACCESS_KEY_ID = aws.config.credentials.accessKeyId;
					process.env.AWS_SECRET_ACCESS_KEY = aws.config.credentials.secretAccessKey;
					process.env.AWS_SESSION_TOKEN = aws.config.credentials.sessionToken ?? '';

					console.log(`[+] Successfully resumed session as ${cache.profile}; Valid for ${((cache.expireTime - Date.now()) / 60000).toFixed(0)} minutes.`);

					return valid;
				}

				console.log(`[!] Cache expires in ${((cache.expireTime - Date.now()) / 60000).toFixed(0)} minutes. Skipping.`);
			}

		} catch (e) {
			console.log(e);
			cache = {};
		}
	}

	// Use long-term creds if they're present. Remove the cache if successful.
	if (!!creds.aws_access_key_id && !!creds.aws_secret_access_key) {
		try {
		
			aws.config.update({
				credentials: {
					accessKeyId: creds.aws_access_key_id,
					secretAccessKey: creds.aws_secret_access_key
				}
			});

			process.env.AWS_ACCESS_KEY_ID = creds.aws_access_key_id;
			process.env.AWS_SECRET_ACCESS_KEY = creds.aws_secret_access_key;

			valid = await verifyCredentials();

			if (!valid) {
				throw new Error("AWS profile credential verification error");
			}

			console.log(`[+] Authenticated as ${valid.Arn ?? valid.arn}`);

			if (fs.existsSync(cacheFile)) {
				fs.unlinkSync(cacheFile);
			}

		} catch (e) {
			throw new Error(`Long term credentials for profile [${profile}] are invalid: ${e}`);
		}

		if (!!process.env.SPELLCRAFT_ASSUMEROLE) {
			valid = await processRoleChain();
		}

		return valid;
	}

	if (!!creds.role_arn && !!creds.source_profile) {
		aws.config.update({
			credentials: {
				accessKeyId: credfile[creds.source_profile].aws_access_key_id,
				secretAccessKey: credfile[creds.source_profile].aws_secret_access_key
			}
		});

		const parameters = {
			RoleArn: creds.role_arn,
			RoleSessionName: `spellcraft_assumerole_${Date.now()}`,
			DurationSeconds: creds.duration_seconds || 3600
		}

		if (!!creds.mfa_serial) {
			parameters.SerialNumber = creds.mfa_serial;
			parameters.TokenCode = await getMFAToken(creds.mfa_serial);
		}

		try {
			const sts = new aws.STS();
			const role = await sts.assumeRole(parameters).promise();

			aws.config.update({
				credentials: sts.credentialsFrom(role)
			});

			let valid = await verifyCredentials();

			if (!valid) {
				throw new Error("AWS assumerole credential verification error");
			}

			console.log(`[+] Successfully assumed role [${creds.role_arn}]`);

			fs.writeFileSync(cacheFile, JSON.stringify({
				accessKeyId: aws.config.credentials.accessKeyId,
				secretAccessKey: aws.config.credentials.secretAccessKey,
				sessionToken: aws.config.credentials.sessionToken,
				expireTime: new Date(aws.config.credentials.expireTime).getTime(),
				expired: aws.config.credentials.expired,
				profile
			}), { mode: '600' });

			process.env.AWS_PROFILE = '';
			process.env.AWS_ACCESS_KEY_ID = aws.config.credentials.accessKeyId;
			process.env.AWS_SECRET_ACCESS_KEY = aws.config.credentials.secretAccessKey;
			process.env.AWS_SESSION_TOKEN = aws.config.credentials.sessionToken ?? '';

		} catch(e) {
			throw new Error(`[!] Failed to assume role ${creds.role_arn} via profile ${creds.source_profile}: ${e}`);
		}

		if (!!process.env.SPELLCRAFT_ASSUMEROLE) {
			valid = await processRoleChain();
		}

		return valid;
	}
}

async function processRoleChain() {
	const cacheFile = `${os.homedir()}/.aws/profile_cache.json`;

	if (!!process.env.SPELLCRAFT_ASSUMEROLE) {
		console.log(`[*] SPELLCRAFT_ASSUMEROLE is set, attempting to assume role with arn [ ${process.env.SPELLCRAFT_ASSUMEROLE} ]`);
		const parameters = {
			RoleArn: process.env.SPELLCRAFT_ASSUMEROLE,
			RoleSessionName: `spellcraft_assumerole_${Date.now()}`,
			DurationSeconds: 3600
		}

		try {
			const sts = new aws.STS();
			const role = await sts.assumeRole(parameters).promise();

			aws.config.credentials = sts.credentialsFrom(role);

			let valid = await verifyCredentials();

			if (!valid) {
				throw new Error("AWS assumerole credential verification error");
			}

			console.log(`[+] Successfully assumed role [${process.env.SPELLCRAFT_ASSUMEROLE}]`);

			fs.writeFileSync(cacheFile, JSON.stringify({
				accessKeyId: aws.config.credentials.accessKeyId,
				secretAccessKey: aws.config.credentials.secretAccessKey,
				sessionToken: aws.config.credentials.sessionToken,
				expireTime: new Date(aws.config.credentials.expireTime).getTime(),
				expired: aws.config.credentials.expired,
				profile: process.env.SPELLCRAFT_ASSUMEROLE
			}), { mode: '600' });

			process.env.AWS_PROFILE = '';
			process.env.AWS_ACCESS_KEY_ID = aws.config.credentials.accessKeyId;
			process.env.AWS_SECRET_ACCESS_KEY = aws.config.credentials.secretAccessKey;
			process.env.AWS_SESSION_TOKEN = aws.config.credentials.sessionToken ?? '';

			return valid;

		} catch(e) {
			throw new Error(`[!] Failed to assume chained role ${process.env.SPELLCRAFT_ASSUMEROLE}: [${e}]`);
		}
	}

	return true;
}

function getMFAToken(mfaSerial) {
	return new Promise((success, failure) => {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		rl.question(`Enter MFA code for ${mfaSerial}: `, function(token) {
			rl.close();

			console.log("");

			if (!token) {
				return getMFAToken(mfaSerial);
			}

			return success(token);
		});

		rl._writeToOutput = function(char) {
			if (char.charCodeAt(0) != 13) {
				rl.output.write('*');
			}
		}
	});
}

async function verifyCredentials() {
	const sts = new aws.STS();

	try {
		const caller = await sts.getCallerIdentity().promise();
		delete caller.ResponseMetadata;
		return caller;
	} catch (e) {
		throw new Error(`[!] Credential validation failed with error: ${e}`);
	}
}

/**
 * This block documents new CLI functionality. Copy it for each command you add.
 * @name aws-identity
 * @function
 * @memberof module:spellcraft-aws-auth-cli
 *
 * @example
 * export AWS_PROFILE=default
 * spellcraft aws-identity
 *
 * # Returns:
 * {
 * 	UserId: 'AIDAEXAMPLEYQR4QJD6WG',
 * 	Account: '123456789012',
 * 	Arn: 'arn:aws:iam::123456789012:user/you'
 * }

 */

/**
 * Outputs the current credential context as environment variables. Useful
 * for reusing credentials from role assumption in other tools.
 * 
 * @name aws-exportcredentials
 * @function
 * @memberof module:spellcraft-aws-auth-cli
 *
 * @example
 * # Render config.jsonnet, then run packer init and packer build
 * SPELLCRAFT_ASSUMEROLE="arn:aws:iam::123456789012:role/myDeploymentRole"
 * spellcraft export-credentials
 *
 * # Returns:
 * export AWS_ACCESS_KEY_ID=<access key from role assumption>
 * export AWS_SECRET_ACCESS_KEY=<secret key from role assumption>
 * export AWS_SESSION_TOKEN=<session token from role assumption>
 */