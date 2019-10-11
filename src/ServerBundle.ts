import {createBundleRenderer} from "vue-server-renderer";

// Declare v8js functions
declare var var_dump;
declare var exit;

// Check if we got a v8js environment
const isV8Js = typeof print === "function" && typeof var_dump === "function" && typeof exit === "function";

function vueServerRenderer(url: string, clientManifestPath?: string, serverManifestPath?: string, templatePath?: string): Promise<string> {

	// Prepare the local constants
	const clientManifest = typeof clientManifestPath === "string" ? require(clientManifestPath) : undefined;
	const serverManifest = typeof clientManifestPath === "string" ? require(serverManifestPath) : undefined;
	const template = typeof clientManifestPath === "string" ? require(templatePath) : undefined;

	// Prepare the renderer
	const renderer = createBundleRenderer(serverManifest, {
		runInNewContext: false,
		template,
		clientManifest
	});

	// Start the renderer
	return renderer.renderToString({url: url});
}

if (isV8Js) {
	// Check if we should skip this
	if (typeof process.env.V8JS_NO_AUTO_RENDER === "undefined") {
		// Try to get the variables from the environment
		if (typeof process.env.V8JS_REQUEST_URL !== "string")
			throw new Error("The server renderer has to define a environment variable \"V8JS_REQUEST_URL\" to transport the url!");

		var_dump("got url" + process.env.V8JS_REQUEST_URL);
	}

}


export default "Default node!";