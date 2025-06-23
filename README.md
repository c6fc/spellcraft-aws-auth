# SpellCraft Packer Integration

[![NPM version](https://img.shields.io/npm/v/spellcraft-aws-auth.svg?style=flat)](https://www.npmjs.com/package/spellcraft-aws-auth)
[![License](https://img.shields.io/npm/l/spellcraft-aws-auth.svg?style=flat)](https://opensource.org/licenses/MIT)

Seamlessly integrate [AWS SDK for JavaScript (v2)](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/) into your [SpellCraft](https://github.com/@c6fc/spellcraft) SpellFrames. This plugin allows you to natively expose authenticated AWS contexts or role-chains to your SpellFrames, and use the full power of the SDK in both JavaScript native functions and JSonnet.

```sh
npm install --save @c6fc/spellcraft

# Install and expose this module with name 'awsauth'
npx spellcraft importModule spellcraft-aws-auth awsauth
```

This module will use credential sources in the same order as the AWS SDK for JavaScript, with role-assumption happening after the priority credential source is identified. If the role requires MFA, spellcraft will prompt for it.

```sh
# Show your current AWS credential context
npx spellcraft aws-identity

{
	"Account": "123456789012"
	"Arn": "arn:aws:iam::123456789012:user/you",
	"UserId": "AIDAEXAMPLEAAAAA"
}
```

You can perform an assumeRole operation using this initial context to chain into a different deployment role by setting the SPELLFRAME_ASSUMEROLE envvar:

```sh
export SPELLFRAME_ASSUMEROLE="arn:aws:iam::345678901234:role/deployment"

# She the new assumerole credential context:
npx spellcraft aws-identity

{
	"Account": "345678901234"
	"Arn": "arn:aws:iam::345678901234:assumed-role/deployment/spellcraft_assumerole_timestamp",
	"UserId": "AROAEXAMPLEBBBB:spellcraft_assumerole_timestamp"
}
```

## Features

- Authenticate to AWS with native means, as well as role assumptions with `SPELLFRAME_ASSUMEROLE`
- Provide an authenticated `aws` instance to function contexts.
- Expose all AWS-SDK clients and methods directly to JSonnet.

## CLI Commands

This plugin returns the following functions:

###	`spellframe aws-identity`

Returns a JSON object containing the response from AWS STS GetCallerIdentity. This represents the AWS identity that your SpellFrame will use in your current context.

### `spellframe aws-exportcredentials`

Exports the current credential context as `export <envvar>=<value>` to simplify testing or development in the context SpellFrame is operating in.

## SpellFrame 'init()' features

Extends the SpellFrame's `init()` to include obtaining AWS credentials, and optionally performing an STS AssumeRole, before instantiating the AWS SDK for JavaScript.

## JavaScript context features

Exposes an instance of the AWS-SDK v2 as `aws` for all native function executions.

## Exposed module functions

Exposes the following functions to JSonnet through the import module:

*	`api(clientObj, method, params="")`
*	`call(name, method, params="")`
*	`client(service, params={})`

*	`assertIdentity(arn)`
*	`getCallerIdentity()`
*	`getRegionsList()`
*	`getAvailabilityZones()`

Generate documentation with `npm run doc` to see more detailed information about how to use these features.


## Installation

Install the plugin as a dependency in your SpellCraft project:

```bash
# Create a SpellCraft project if you haven't already
npm install --save @c6fc/spellcraft

# Install and expose this module with name 'foo'
npx spellcraft importModule spellcraft-aws-auth foo
```

Once installed, you can load the module into your JSonnet files by the name you specified with `importModule`, in this case 'foo':

```jsonnet
local foo = import "foo";

'identity.json': {
	foo: foo.getCallerIdentity()
}
```

## Documentation

You can generate JSDoc documentation for this plugin using `npm run doc`. Documentation will be generated in the `doc` folder.