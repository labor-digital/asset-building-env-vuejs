import ExpressContext from "@labor/asset-building/dist/Express/ExpressContext";
import fs from "fs";
import * as path from "path";
import {createBundleRenderer} from "vue-server-renderer";
import LRU from "lru-cache";
import {Configuration} from "webpack";
import MemoryFileSystem = require("memory-fs");

declare global {
	namespace NodeJS {
		interface Global {
			EXPRESS_VUE_SSR_MODE: boolean
			EXPRESS_VUE_SSR_UPDATE_RENDERER: Function
		}
	}
}

/**
 * Marks this process as using the vue ssr plugin
 */
global.EXPRESS_VUE_SSR_MODE = true;

/**
 * Finds the webpack config object we need for our internal logic
 * @param context
 */
function getWebpackConfig(context: ExpressContext): Promise<Configuration> {
	if (!context.isProd) return Promise.resolve(context.parentContext.webpackConfig);
	return context.factory.getWebpackConfig(context.appId);
}

/**
 * Holds the prepared metadata to replace in the stream chunks
 */
let preparedMetaData: null | Array<{ find: RegExp, replace: string }> = null;

/**
 * Internal helper to apply the vue-meta properties into our template
 * @see https://vue-meta.nuxtjs.org/guide/ssr.html#inject-metadata-into-page-stream
 * @param vueContext
 * @param chunk
 */
function applyMetaData(vueContext, chunk: string): string {
	if (typeof vueContext.meta === "undefined") return chunk;

	const {
		title, htmlAttrs, headAttrs, bodyAttrs, link,
		style, script, noscript, meta
	} = vueContext.meta.inject();
	preparedMetaData = [];

	// Build the placeholders
	const nl = "\r\n";
	chunk = chunk.replace(/data-vue-template-html/g, "data-vue-meta-server-rendered " + htmlAttrs.text());
	chunk = chunk.replace(/data-vue-template-head/g, headAttrs.text());
	chunk = chunk.replace(/<!--vue-head-outlet-->/g, meta.text() + nl + title.text() + nl + link.text() + nl
		+ style.text() + nl + script.text() + nl + noscript.text());
	chunk = chunk.replace(/data-vue-template-body/g, bodyAttrs.text());
	chunk = chunk.replace(/<!--vue-pbody-outlet-->/g, style.text({pbody: true}) + nl + script.text({pbody: true}) + noscript.text({pbody: true}));
	chunk = chunk.replace(/<!--vue-body-outlet-->/g, style.text({body: true}) + nl + script.text({body: true}) + noscript.text({body: true}));

	// Done
	return chunk;
}

module.exports = function expressSsrPlugin(context: ExpressContext): Promise<ExpressContext> {

	/**
	 * Internal helper to recreate the bundle renderer instance when webpack rebuilt the defnition
	 * @param bundle
	 * @param template
	 * @param clientManifest
	 */
	function createRenderer(bundle, template, clientManifest?) {
		return createBundleRenderer(bundle, {
			runInNewContext: process.env.NODE_ENV === "development",
			template,
			clientManifest,
			cache: new LRU({
				max: process.env.NODE_ENV === "development" ? 1 : 1000,
				maxAge: 1000 * 60 * 15
			})
		});
	}

	return getWebpackConfig(context)
		.then(webpackConfig => {
			let renderer = null;
			if (context.isProd) {
				const serverBundle = require(path.resolve(webpackConfig.output.path, "./vue-ssr-server-bundle.json"));
				const clientManifest = require(path.resolve(webpackConfig.output.path, "./vue-ssr-client-manifest.json"));

				const template = fs.readFileSync(path.resolve(webpackConfig.output.path, "./index.html"), "utf-8");
				renderer = createRenderer(serverBundle, template, clientManifest);
			} else {

				let template = null;
				let bundle = null;
				let clientManifest = undefined;

				// Register global render generation
				global.EXPRESS_VUE_SSR_UPDATE_RENDERER = (type: "template" | "bundle" | "clientManifest", value: string) => {
					try {
						if (type === "template") {
							template = value;
							if (bundle !== null) renderer = createRenderer(bundle, template, clientManifest);
						} else if (type === "bundle") {
							bundle = value;
							if (template !== null) renderer = createRenderer(bundle, template, clientManifest);
						} else if (type === "clientManifest") {
							clientManifest = JSON.parse(value);
						}
					} catch (e) {
						console.log(e);
						process.exit(1);
					}
				};

				// Register callback when the compiler is done
				context.compiler.hooks.done.tap("ExpressSsrPlugin", () => {
					const mfs: MemoryFileSystem = context.compiler.outputFileSystem as any;

					// Update the client manifest
					const clientManifestPath = path.join(webpackConfig.output.path, "vue-ssr-client-manifest.json");
					if (mfs.existsSync(clientManifestPath))
						global.EXPRESS_VUE_SSR_UPDATE_RENDERER("clientManifest", mfs.readFileSync(clientManifestPath).toString("utf-8"));

					// Update the template
					const indexFilePath = path.join(webpackConfig.output.path, "index.html");
					if (mfs.existsSync(indexFilePath))
						global.EXPRESS_VUE_SSR_UPDATE_RENDERER("template", mfs.readFileSync(indexFilePath).toString("utf-8"));
				});
			}

			// Serve our generated assets
			context.expressApp.use(webpackConfig.output.publicPath.replace(/^\./, ""),
				require("express").static(webpackConfig.output.path));

			// Register the catch all express route
			context.expressApp.get("*", (req, res) => {
				if (!renderer) return res.end("Waiting for compilation... Refresh in a moment.");
				const s = Date.now();
				res.setHeader("Content-Type", "text/html");

				const errorHandler = err => {
					if (err && err.code === 404) {
						res.status(404).end("404 | Page Not Found");
					} else {
						// Render Error Page or Redirect
						res.status(500).end("500 | Internal Server Error");
						console.error(`Error during render : ${req.url}`);
						console.error(err);
					}
				};

				// Create the rendering stream
				const vueContext = {url: req.url, status: 200};
				const stream = renderer.renderToStream(vueContext);

				// Add the status to the response object
				stream.once("data", () => res.status(vueContext.status));

				// Apply meta data by the "vue-meta" plugin
				stream.on("data", (chunk: Buffer) => {
					res.write(applyMetaData(vueContext, chunk.toString("utf-8")));
				});

				// End the response when the stream ends
				stream.on("end", () => {
					console.log(`Request duration: ${Date.now() - s}ms`);
					res.end();
				});

				// Handle errors
				stream.on("error", errorHandler);
			});

			return Promise.resolve(context);
		});


};