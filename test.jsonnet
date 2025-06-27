/*
	`npm run test` and `npm run cli` always links the current module as 'foo'.
	
	This file should manifest all the exposed features of your module
	so users can see examples of how they are used, and the output they
	generate.
*/

local foo = import "foo.libsonnet";

{
	getCallerIdentity: foo.getCallerIdentity()
}