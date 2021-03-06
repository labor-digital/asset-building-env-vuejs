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
 * Last modified: 2020.02.17 at 22:21
 */

import {AssetBuilderConfiguratorIdentifiers} from "@labor-digital/asset-building/dist/AssetBuilderConfiguratorIdentifiers";
import {AssetBuilderEventList} from "@labor-digital/asset-building/dist/AssetBuilderEventList";
import {ProcessManager} from "@labor-digital/asset-building/dist/Core/ProcessManager";
import {WorkerContext} from "@labor-digital/asset-building/dist/Core/WorkerContext";
import {AppDefinitionInterface} from "@labor-digital/asset-building/dist/Interfaces/AppDefinitionInterface";
import {md5} from "@labor-digital/helferlein/lib/Misc/md5";
import {isPlainObject} from "@labor-digital/helferlein/lib/Types/isPlainObject";
import path from "path";
import {VueLoaderPlugin} from "vue-loader";
import {merge} from "webpack-merge";
import {VueJsEventList} from "./VueJsEventList";

export default function (context: WorkerContext, scope: string) {
	if (scope !== "app") throw new Error("The vue extension cannot be defined on a global scope!");
	
	// Filtering of the ssr node-externals allow list
	let nodeExternalsAllowList = /\.css$|\.vue$|[\\\/]src[\\\/]|[\\\/]source[\\\/]/;
	context.eventEmitter.bind(AssetBuilderEventList.AFTER_WORKER_INIT_DONE, () => {
		return context.eventEmitter.emitHook(VueJsEventList.SSR_EXTERNAL_ALLOW_LIST_FILTER,
			{allowList: nodeExternalsAllowList})
			.then(args => nodeExternalsAllowList = args.allowList);
	});
	
	// Add our custom configuration
	context.eventEmitter.bind(AssetBuilderEventList.APPLY_EXTENSION_WEBPACK_CONFIG, (e) => {
		const context: WorkerContext = e.args.context;
		
		// Add vue loader
		context.webpackConfig.module.rules.push({
			test: /\.vue$/,
			loader: "vue-loader",
			options: {
				cacheBusting: true,
				transformToRequire: {
					video: ["src", "poster"],
					source: "src",
					img: "src",
					image: "xlink:href"
				}
			}
		});
		
		// Disable node module injections
		context.webpackConfig = merge(context.webpackConfig, {
			resolve: {
				extensions: [".vue", ".tsx"]
			},
			node: {
				// Prevent webpack from injecting useless setImmediate polyfill because Vue
				// source contains it (although only uses it if it's native).
				setImmediate: false,
				// Prevent webpack from injecting mocks to Node native modules
				// that does not make sense for the client
				dgram: "empty",
				fs: "empty",
				net: "empty",
				tls: "empty",
				child_process: "empty"
			}
		});
		
		// Add vue plugin
		context.webpackConfig.plugins.push(new VueLoaderPlugin());
		
		// Add server side rendering configuration if required
		if (context.app.useSsr || global.EXPRESS_VUE_SSR_MODE === true) {
			if (context.app.ssrWorker === "server") {
				// Manifest definition
				context.webpackConfig = merge(context.webpackConfig, {
					// This allows webpack to handle dynamic imports in a Node-appropriate
					// fashion, and also tells `vue-loader` to emit server-oriented code when
					// compiling Vue components.
					target: "node",
					
					// For bundle renderer source map support
					devtool: "source-map",
					
					// This tells the server bundle to use Node-style exports
					output: {
						libraryTarget: "commonjs2"
					},
					
					// https://webpack.js.org/configuration/externals/#function
					// https://github.com/liady/webpack-node-externals
					// Externalize app dependencies. This makes the server build much faster
					// and generates a smaller bundle file.
					externals: ((require("webpack-node-externals"))({
						// do not externalize dependencies that need to be processed by webpack.
						// you can add more file types here e.g. raw *.vue files
						// you should also allow deps that modifies `global` (e.g. polyfills)
						allowlist: nodeExternalsAllowList
					})),
					
					// This is the plugin that turns the entire output of the server build
					// into a single JSON file. The default file name will be
					// `vue-ssr-server-bundle.json`
					plugins: [
						new (require("vue-server-renderer/server-plugin"))(),
						// Define some useful environment variables
						new (require("webpack")).DefinePlugin({
							"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV === "production" || context.isProd ? "production" : "development"),
							"process.env.VUE_ENV": "\"server\""
						})
					]
				});
			} else {
				// Client definition
				context.webpackConfig = merge(context.webpackConfig, {
					plugins: [
						// Important: this splits the webpack runtime into a leading chunk
						// so that async chunks can be injected right after it.
						// this also enables better caching for your app/vendor code.
						new (require("webpack")).optimize.SplitChunksPlugin({
							name: "manifest",
							minChunks: Infinity
						}),
						// This plugins generates `vue-ssr-client-manifest.json` in the
						// output directory.
						new (require("vue-server-renderer/client-plugin"))(),
						// Define some useful environment variables
						new (require("webpack")).DefinePlugin({
							"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV === "production" || context.isProd ? "production" : "development"),
							"process.env.VUE_ENV": "\"client\""
						})
					]
				});
				
				// Rewrite output file
				const hash = md5((new Date()).toTimeString() + "-" + Math.random() + Math.random());
				context.webpackConfig.output.filename =
					context.webpackConfig.output.filename.replace(/(.*?)\.([^.]*?)/g, "$1-" + hash + ".$2");
			}
		}
	});
	
	// Add additional polyfills to support vue-i18n
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_POLYFILLS, (e) => {
		e.args.polyfills.push("core-js/features/array/includes.js");
	});
	
	// Set jsx factory in typescript
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_TYPESCRIPT_OPTIONS, (e) => {
		e.args.options.compilerOptions.jsxFactory = "h";
	});
	
	// Listen for the server bundle compiler
	context.eventEmitter.bind(AssetBuilderEventList.WEBPACK_COMPILER, e => {
		const context: WorkerContext = e.args.context;
		
		// Ignore if we are not running in express mode
		if (context.parentContext.environment !== "express") return;
		if (context.app.ssrWorker !== "server" || typeof context.webpackConfig.output.path !== "string") return;
		
		// Set the compiler to the memory fs
		const MFS = require("memory-fs");
		const mfs = new MFS();
		e.args.webpackCompiler.compiler.outputFileSystem = mfs;
		
		// Register the on done hook
		e.args.webpackCompiler.compiler.hooks.done.tap("ExpressSsrServerPlugin", () => {
			const bundlePath = path.join(context.webpackConfig.output.path, "vue-ssr-server-bundle.json");
			process.send({
				VUE_SSR_BUNDLE: mfs.existsSync(bundlePath) ?
					JSON.parse(mfs.readFileSync(bundlePath, "utf-8")) : null
			});
		});
	});
	
	// Inject our own app schema property
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_APP_DEFINITION_SCHEMA, (e) => {
		e.args.schema.useCssExtractPlugin = {
			type: ["undefined", "true"],
			default: undefined
		};
		e.args.schema.useSsr = {
			type: "bool",
			default: false
		};
		e.args.schema.useSsrServerExternals = {
			type: "bool",
			default: false
		};
		e.args.schema.ssrWorker = {
			type: ["undefined", "string"],
			default: undefined
		};
	});
	
	// Inject custom template if we are using vue server side rendering
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_HTML_PLUGIN_TEMPLATE, e => {
		if (context.app.useSsr !== true && global.EXPRESS_VUE_SSR_MODE !== true) return;
		e.args.template.template = path.join(__dirname, "../indexTemplate/index.ejs");
		e.args.template.minify = false;
		e.args.template.inject = false;
	});
	
	// Check if we have to spawn the SSR renderers
	context.eventEmitter.bind(AssetBuilderEventList.AFTER_WORKER_INIT_DONE, (e) => {
		const context: WorkerContext = e.args.context;
		
		// Make sure the html template is enabled in ssr mode
		const isSsr = context.app.useSsr === true || global.EXPRESS_VUE_SSR_MODE === true;
		if (!isSsr) return;
		if (context.app.htmlTemplate === null || typeof context.app.htmlTemplate === "undefined")
			context.app.htmlTemplate = true;
		
		// Ignore if the context is not correct
		if (typeof context.app.ssrWorker !== "undefined") return;
		if (context.parentContext.environment === "express" && context.parentContext.isProd) return;
		
		// Create our process manager
		const processManager = new ProcessManager(context.eventEmitter);
		
		const serverAppConfig: AppDefinitionInterface = JSON.parse(JSON.stringify(context.app));
		serverAppConfig.appName += " - Server Generator";
		serverAppConfig.id += 1000;
		serverAppConfig.minChunkSize = 999999999;
		serverAppConfig.polyfills = false;
		serverAppConfig.keepOutputDirectory = true;
		serverAppConfig.disableGitAdd = true;
		serverAppConfig.verboseResult = true;
		serverAppConfig.useSsr = true;
		serverAppConfig.ssrWorker = "server";
		
		// Add our callback when the process finished
		const serverProcessListener = (e) => {
			e.args.process.on("message", message => {
				if (typeof message.VUE_SSR_BUNDLE === "undefined") return;
				if (typeof global.EXPRESS_VUE_SSR_UPDATE_RENDERER === "undefined") return;
				global.EXPRESS_VUE_SSR_UPDATE_RENDERER("bundle", message.VUE_SSR_BUNDLE);
			});
		};
		context.eventEmitter.bind(AssetBuilderEventList.PROCESS_CREATED, serverProcessListener);
		
		// Make sure to set the correct mode
		const modeBackup = context.parentContext.mode;
		context.parentContext.mode = context.parentContext.isProd ? "build" : "watch";
		
		// Create the server worker
		processManager.startSingleWorkerProcess(context.parentContext, serverAppConfig)
			.catch((err) => {
				if (typeof err === "string") throw new Error(err);
				throw err;
			});
		
		context.eventEmitter.unbind(AssetBuilderEventList.PROCESS_CREATED, serverProcessListener);
		context.parentContext.mode = modeBackup;
		
	});
	
	// Make sure the styles get minified when we are using server side rendering in production mode
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_POSTCSS_PLUGINS, (e) => {
		// Ignore if this is neither a ssr app, nor build for production
		if (context.app.useSsr !== true || !context.isProd) return;
		
		// Add the css minifier plugin
		e.args.plugins.push(require("cssnano"));
	});
	
	// Make sure we don't run into issues when using the css extract plugin with vue modules
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_PLUGIN_CONFIG, (e) => {
		if (e.args.identifier !== AssetBuilderConfiguratorIdentifiers.CSS_EXTRACT_PLUGIN) return;
		e.args.config.ignoreOrder = true;
	});
	
	// Make sure we don't remove the vue-ssr-server-bundle.json in the clean output dir plugin
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_PLUGIN_CONFIG, (e) => {
		if (e.args.identifier !== AssetBuilderConfiguratorIdentifiers.CLEAN_OUTPUT_DIR_PLUGIN) return;
		e.args.config.cleanOnceBeforeBuildPatterns.push("!vue-ssr-server-bundle.json");
	});
	
	// Change the style loader to use the vue style loader
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_LOADER_CONFIG, (e) => {
		const cssExtractorPluginRegex = new RegExp("mini-css-extract-plugin");
		// Register additional loader to strip out all /deep/ selectors we need for component nesting,
		// but that are not wanted in a browser environment
		if (e.args.identifier === AssetBuilderConfiguratorIdentifiers.SASS_LOADER ||
			e.args.identifier === AssetBuilderConfiguratorIdentifiers.LESS_LOADER) {
			const deepRemoverPath = path.resolve(__dirname, "DeepRemoverLoader.js");
			e.args.config.use.forEach((v, k) => {
				
				// Inject vue style loader
				if (v.loader.match(cssExtractorPluginRegex)) {
					const before = e.args.config.use.slice(0, k + 1);
					const after = e.args.config.use.slice(k + 1);
					e.args.config.use = [
						...before,
						deepRemoverPath,
						...after
					];
				}
			});
		}
		
		// If we are in production mode and we don't use the server
		// side renderer we will not inject the vue style loader
		if (context.app.useSsr !== true && context.isProd) return;
		
		// Skip if the package requires us to use the css extract plugin
		if (context.app.useCssExtractPlugin === true) return;
		
		const cssLoaderRegex = /^css-loader/;
		
		// Rewrite sass loader
		if (e.args.identifier === AssetBuilderConfiguratorIdentifiers.SASS_LOADER) {
			e.args.config.use.forEach((v, k) => {
				if (typeof v === "string") v = {loader: v};
				if (typeof v.loader === "undefined") return;
				
				// Update css-loader options
				// @see https://github.com/vuejs/vue-style-loader/issues/46#issuecomment-670624576
				if (v.loader.match(cssLoaderRegex) && isPlainObject(e.args.config.use[k].options)) {
					e.args.config.use[k].options.esModule = false;
				}
				
				// Inject vue style loader
				if (v.loader.match(cssExtractorPluginRegex)) {
					e.args.config.use[k] = "vue-style-loader";
				}
			});
		}
		
		// Rewrite less loader
		if (e.args.identifier === AssetBuilderConfiguratorIdentifiers.LESS_LOADER) {
			e.args.config.use.forEach((v, k) => {
				if (typeof v === "string") v = {loader: v};
				if (typeof v.loader === "undefined") return;
				
				// Update css-loader options
				// @see https://github.com/vuejs/vue-style-loader/issues/46#issuecomment-670624576
				if (v.loader.match(cssLoaderRegex) && isPlainObject(e.args.config.use[k].options)) {
					e.args.config.use[k].options.esModule = false;
				}
				
				// Inject vue style loader
				if (v.loader.match(cssExtractorPluginRegex))
					e.args.config.use[k] = "vue-style-loader";
			});
		}
	});
}