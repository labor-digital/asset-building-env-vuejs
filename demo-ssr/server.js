const expressAssetBuildingPlugin = require("@labor-digital/asset-building/dist/Express/expressAssetBuildingPlugin.js");
const expressDevServerPlugin = require("@labor-digital/asset-building-dev-server/dist/expressDevServerPlugin.js");
const expressSsrPlugin = require("@labor-digital/asset-building-env-vuejs/dist/expressSsrPlugin.js");
const express = require("express");
const app = express();
const port = 8000;

// Demo for environment setting
if (process.argv[2] === "development") process.env.NODE_ENV = "development";

// Create the express asset builder context
expressAssetBuildingPlugin(app)

	// Register your custom routes, those will not reach the expressSsrPlugin!
	.then(context => {
		context.expressApp.get("/test", (req, res) => {
			res.send("Not served by dev server!");
		});
		// Return the context
		return context;
	})

	// Optional: register the asset-builder dev-server plugin
	.then(expressDevServerPlugin)

	// Register the ssr plugin which acts as a wildcard for everything that is not defined above
	.then(expressSsrPlugin)

	// Optional: register the ssr plugin with additional configuration options
	// To use the options, call the configure method instead of passing the function through to the promise handler
	// .then(expressSsrPlugin.configure({
	// 		envVars: ["MY_VAR"]
	// }))

	// Create the app
	.then(context => {
		context.expressApp.listen(port, () => console.log(`\r\nExample app listening on port ${port}!`));
	});
