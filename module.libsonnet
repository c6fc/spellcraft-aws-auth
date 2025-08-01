/**
 * @module spellcraft-aws-auth
 * @description This module represents the JSonnet and JavaScript native
 * functions exposed by this plugin.
 */

// Don't try to 'import' your spellcraft native functions here.
// Use std.native(function)(..args) instead

{
	// JS Native functions are already documented in spellcraft_modules/foo.js
	// but need to be specified here to expose them through the import

	local aws = self,


	/**
	 * Creates an instance of the AWS service client which can be used to make API calls.
	 * This is only necessary if the client instantiation requires non-default parameters
	 * such as 'region'. Otherwise, aws.call() below is simpler.
	 *
	 * @function client
	 * @param {string} service
	 * @param {object} [params={}]
	 * @memberof module:spellcraft-aws-auth
	 * @returns {Class.AWS.service}
	 * @example
	 * local aws = import "aws";
	 * local stsClient = aws.client('STS', { region: "us-east-1" });
	 *
	 * { identity: aws.api(stsClient,'getCallerIdentity') }
	 */
	client(service, params={}):: {
		service: service,
		params: params
	},

	/**
	 * Makes an AWS API call using the provided client, of the specified method
	 * and with the supplied parameters.
	 * 
	 * @function api
	 * @param {Class.AWS.service} client
	 * @param {string} method
	 * @param {object} [params={}]
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} result
	 * @example
	 * local aws = import "aws";
	 * local stsClient = aws.client('STS', { region: "us-east-1" });
	 *
	 * { identity: aws.api(stsClient,'getCallerIdentity') }
	 */
	api(clientObj, method, params=""):: std.native('aws')(
		std.manifestJsonEx(clientObj, ''),
		method,
		std.manifestJsonEx(params, '')
	),

	/**
	 * This is a shortcut for calling aws.api(aws.client(service, {}), method)
	 * Useful for when your service client requires no extra parameters.
	 *
	 * @function call
	 * @param {Class.AWS.service} client
	 * @param {string} method
	 * @param {object} [params={}]
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} result
	 * @example
	 * local aws = import "aws";
	 *
	 * { identity: aws.call('STS','getCallerIdentity') }
	 */
	call(name, method, params=""):: aws.api(
		aws.client(name),
		method,
		params
	),

	/**
	 * Terminates manifestation if the current AWS identity ARN doesn't match the provided
	 * value. Useful for sanity checking prior to deployment.
	 *
	 * @function assertIdentity
	 * @param {string} method
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} result
	 * @example
	 * local aws = import "aws";
	 *
	 * { identity:: aws.assertIdentity('arn:aws:iam:123456789012:user/you') }
	 */
	assertIdentity(arn)::
		assert aws.getCallerIdentity().Arn == arn : "Not authenticated as [ %s ]" % [arn];
		arn,

	/**
	 * Returns details of the current AWS security principal context
	 *
	 * @function getCallerIdentity
	 * @memberof module:spellcraft-aws-auth
	 * @example
	 * local aws = import "aws";
	 *
	 * { identity: aws.getCallerIdentity() }
	 */
	getCallerIdentity():: aws.call('STS', 'getCallerIdentity'),

	getRegionsList():: std.map(
		function (x) x.RegionName,
		aws.call('EC2', 'describeRegions').Regions
	),

	getAvailabilityZones():: {
		[region]: std.map(
			function (x) x.ZoneName,
			aws.api(aws.client('EC2', { region: region }), 'describeAvailabilityZones').AvailabilityZones
		) for region in aws.getRegionsList()
	},
}