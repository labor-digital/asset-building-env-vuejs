/*
 * Copyright 2020 LABOR.digital
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Last modified: 2020.02.18 at 15:09
 */

import ExpressContext from "@labor-digital/asset-building/dist/Interop/Express/ExpressContext";
import {PlainObject} from "@labor-digital/helferlein/lib/Interfaces/PlainObject";
import {forEach} from "@labor-digital/helferlein/lib/Lists/forEach";
import {isArray} from "@labor-digital/helferlein/lib/Types/isArray";
import {isFunction} from "@labor-digital/helferlein/lib/Types/isFunction";
import {isObject} from "@labor-digital/helferlein/lib/Types/isObject";
import {isPlainObject} from "@labor-digital/helferlein/lib/Types/isPlainObject";
import {isString} from "@labor-digital/helferlein/lib/Types/isString";
import {isUndefined} from "@labor-digital/helferlein/lib/Types/isUndefined";
import fs from "fs";
import LRU from "lru-cache";
import * as path from "path";
import {BundleRendererOptions, createBundleRenderer} from "vue-server-renderer";
import {Configuration} from "webpack";
import {ExpressSsrPluginOptions} from "./expressSsrPlugin.interfaces";
import {VueJsEventList} from "./VueJsEventList";
import MemoryFileSystem = require("memory-fs");

declare global {
	namespace NodeJS {
		interface Global {
			vueEnv: PlainObject
			EXPRESS_VUE_SSR_MODE: boolean
			EXPRESS_VUE_SSR_UPDATE_RENDERER: Function
		}
	}
}

/**
 * Marks this process as using the vue ssr plugin
 */
global.EXPRESS_VUE_SSR_MODE = true;

// Check if we are in dev mode
const isDevMode = process.env.NODE_ENV === "development";

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
 * Internal helper to inject only the scripts and the state into the build chunks.
 * This avoids issues when the hot reload plugin and the bundle renderer start to fight over
 * the priority of css rules.
 *
 * @param vueContext
 * @param chunk
 */
function applyRendererMetaData(vueContext, chunk: string): string {
	chunk = chunk.replace(/<!--vue-renderer-head-outlet-->/g, function () {
		if (!isDevMode) return "";
		return vueContext.renderScripts() + " " + vueContext.renderState();
	});
	return chunk;
}

/**
 * Internal helper to apply the vue-meta properties into our template
 * @see https://vue-meta.nuxtjs.org/guide/ssr.html#inject-metadata-into-page-stream
 * @param vueContext
 * @param chunk
 */
function applyMetaData(vueContext, chunk: string): string {
	const nl = "\r\n";
	
	// Inject the environment variables
	const jsonEnv = JSON.stringify(vueContext.env);
	const envScript = "<script type='text/javascript'>window.VUE_ENV = " + jsonEnv + ";</script>";
	chunk = chunk.replace(/<!--vue-head-outlet-->/g, () => "<!--vue-head-outlet-->" + nl + envScript);
	
	// Check if we should inject additional metadata
	if (typeof vueContext.meta === "undefined") return chunk;
	
	const {
		title, htmlAttrs, headAttrs, bodyAttrs, link,
		style, script, noscript, meta
	} = vueContext.meta.inject();
	preparedMetaData = [];
	
	
	// Build the placeholders
	chunk = chunk.replace(/data-vue-template-html/g, () => "data-vue-meta-server-rendered " + htmlAttrs.text());
	chunk = chunk.replace(/data-vue-template-head/g, headAttrs.text());
	chunk = chunk.replace(/<!--vue-head-outlet-->/g, () => meta.text() + nl + title.text() + nl + link.text() + nl
		+ style.text() + nl + script.text() + nl + noscript.text());
	chunk = chunk.replace(/data-vue-template-body/g, () => bodyAttrs.text());
	chunk = chunk.replace(/<!--vue-pbody-outlet-->/g, () => style.text({pbody: true}) + nl + script.text({pbody: true}) + noscript.text({pbody: true}));
	chunk = chunk.replace(/<!--vue-body-outlet-->/g, () => style.text({body: true}) + nl + script.text({body: true}) + noscript.text({body: true}));
	
	// Done
	return chunk;
}

/**
 * Registers the required middlewares to render your vue app using server side rendering
 *
 * @param {ExpressContext} context
 * @param {ExpressSsrPluginOptions} options
 */
module.exports = function expressSsrPlugin(context: ExpressContext, options?: ExpressSsrPluginOptions): Promise<ExpressContext> {
	
	// Prepare options
	if (!isPlainObject(options)) options = {};
	if (!isFunction(options.streamWrapper)) options.streamWrapper = (c) => c;
	
	// Register the external allow list update if configured
	if (isObject(options.externalAllowList)) {
		context.factory.getCoreContext().then(context => {
			context.eventEmitter.bind(VueJsEventList.SSR_EXTERNAL_ALLOW_LIST_FILTER, (e) => {
				e.args.allowList = options.externalAllowList;
			}, -500);
		});
	}
	
	/**
	 * Internal helper to recreate the bundle renderer instance when webpack rebuilt the defnition
	 * @param bundle
	 * @param template
	 * @param clientManifest
	 */
	function createRenderer(bundle, template, clientManifest?) {
		const options: BundleRendererOptions = {
			runInNewContext: isDevMode ? true : "once",
			template,
			clientManifest,
			// Don't inject the styles in dev mode to prevent
			// issues (duplicate style tags) when using hot reloading
			inject: !isDevMode
		};
		if (!isDevMode) options.cache = new LRU({
			max: 1000,
			maxAge: 1000 * 60 * 15
		});
		return createBundleRenderer(bundle, options);
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
			context.registerPublicAssets(webpackConfig.output.path, webpackConfig.output.publicPath.replace(/^\./, ""));
			
			// Gather the list of public environment variables
			const environmentVariables: PlainObject = {};
			if (isArray(options.envVars))
				forEach(options.envVars, key => {
					if (isUndefined(process.env[key])) environmentVariables[key] = null;
					else environmentVariables[key] = process.env[key];
				});
			if (isString(process.env.PROJECT_ENV)) environmentVariables.PROJECT_ENV = process.env.PROJECT_ENV;
			
			// Add additional, dynamic variables if required
			if (isPlainObject(options.additionalEnvVars))
				forEach(options.additionalEnvVars, (v, k) => {
					environmentVariables[k] = v;
				});
			
			// Register the catch all express route
			context.expressApp.get("*", (req, res) => {
				if (!renderer) return res.end("Waiting for compilation... Refresh in a moment.");
				const s = Date.now();
				res.setHeader("Content-Type", "text/html");
				
				// Create the rendering stream
				const vueContext = {url: req.url, serverRequest: req, serverResponse: res, env: environmentVariables};
				if (isFunction(options.vueContextFilter)) options.vueContextFilter(vueContext);
				const stream = renderer.renderToStream(vueContext);
				
				// Apply meta data by the "vue-meta" plugin
				stream.on("data", (chunk: Buffer) => {
					res.write(
						options.streamWrapper(
							applyRendererMetaData(vueContext,
								applyMetaData(vueContext, chunk.toString("utf-8"))),
							vueContext
						)
					);
				});
				
				// End the response when the stream ends
				stream.on("end", () => {
					console.log(`Request duration: ${Date.now() - s}ms`);
					res.end();
				});
				
				// Handle errors
				stream.on("error", err => {
					// Render Error Page or Redirect
					res.status(500).end("500 | Internal Server Error");
					console.error(`Error during render : ${req.url}`);
					console.error(err);
				});
			});
			
			return Promise.resolve(context);
		});
	
};

/**
 * A wrapper to add additional configuration options to the plugin
 * @param {ExpressSsrPluginOptions} options
 */
module.exports.configure = function (options: ExpressSsrPluginOptions): Function {
	return (context) => module.exports(context, options);
};

