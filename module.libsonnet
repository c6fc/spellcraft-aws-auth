// Don't try to 'import' your spellcraft native functions here.
// Use std.native(function)(..args) instead

{
	// JS Native functions are already documented in spellcraft_modules/foo.js
	// but need to be specified here to expose them through the import

	local aws = self,


	/**
	 * @function client
	 * @param {string} service
	 * @param {object} [params={}]
	 * @param {string} method
	 * @memberof module:spellcraft-aws-auth
	 * @returns {Class.AWS}
	 * @example
	 * local foo = import "foo";
	 * local stsClient = aws.client('STS', { region: "us-east-1" });
	 *
	 * { identity: aws.api(stsClient,'getCallerIdentity') }
	 * 
	 * // Returns:
	 * { "identity": {
	 *	"UserArn": "<your_user_arn>",
	 *	""
	 } }
	 */
	client(service, params={}):: {
		service: service,
		params: params
	},

	/**
	 * @function beefcakecafe
	 * @param {string} say
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} `moo (${say})`
	 * @example
	 * local foo = import "foo";
	 * { cow: foo.beefcakecafe("hello") }
	 * 
	 * // Returns:
	 * { "cow": "moo (hello)" }
	 */

	api(clientObj, method, params=""):: std.native('aws')(
		std.manifestJsonEx(clientObj, ''),
		method,
		std.manifestJsonEx(params, '')
	),

	/**
	 * Returns 'moo'
	 * This is a libsonnet module rather than a JavaScript native function.
	 *
	 * @function beefcakecafe
	 * @param {string} say
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} `moo (${say})`
	 * @example
	 * local foo = import "foo";
	 * { cow: foo.beefcakecafe("hello") }
	 * 
	 * // Returns:
	 * { "cow": "moo (hello)" }
	 */
	call(name, method, params=""):: aws.api(
		aws.client(name),
		method,
		params
	),

	/**
	 * Returns 'moo'
	 * This is a libsonnet module rather than a JavaScript native function.
	 *
	 * @function beefcakecafe
	 * @param {string} say
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} `moo (${say})`
	 * @example
	 * local foo = import "foo";
	 * { cow: foo.beefcakecafe("hello") }
	 * 
	 * // Returns:
	 * { "cow": "moo (hello)" }
	 */
	assertIdentity(arn)::
		assert aws.getCallerIdentity().Arn == arn : "Not authenticated as [ %s ]" % [arn];
		arn,

	/**
	 * Returns 'moo'
	 * This is a libsonnet module rather than a JavaScript native function.
	 *
	 * @function beefcakecafe
	 * @param {string} say
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} `moo (${say})`
	 * @example
	 * local foo = import "foo";
	 * { cow: foo.beefcakecafe("hello") }
	 * 
	 * // Returns:
	 * { "cow": "moo (hello)" }
	 */
	getCallerIdentity():: aws.call('STS', 'getCallerIdentity'),

	/**
	 * Returns 'moo'
	 * This is a libsonnet module rather than a JavaScript native function.
	 *
	 * @function beefcakecafe
	 * @param {string} say
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} `moo (${say})`
	 * @example
	 * local foo = import "foo";
	 * { cow: foo.beefcakecafe("hello") }
	 * 
	 * // Returns:
	 * { "cow": "moo (hello)" }
	 */
	getRegionsList():: std.map(
		function (x) x.RegionName,
		aws.call('EC2', 'describeRegions').Regions
	),

	/**
	 * Returns 'moo'
	 * This is a libsonnet module rather than a JavaScript native function.
	 *
	 * @function beefcakecafe
	 * @param {string} say
	 * @memberof module:spellcraft-aws-auth
	 * @returns {string} `moo (${say})`
	 * @example
	 * local foo = import "foo";
	 * { cow: foo.beefcakecafe("hello") }
	 * 
	 * // Returns:
	 * { "cow": "moo (hello)" }
	 */
	getAvailabilityZones():: {
		[region]: std.map(
			function (x) x.ZoneName,
			aws.api(aws.client('EC2', { region: region }), 'describeAvailabilityZones').AvailabilityZones
		) for region in aws.getRegionsList()
	},
}