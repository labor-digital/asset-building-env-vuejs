import {WorkerContext} from "@labor/asset-building/dist/Core/WorkerContext";
import {AssetBuilderEventList} from "@labor/asset-building/dist/AssetBuilderEventList";
import merge from "webpack-merge";
import {VueLoaderPlugin} from "vue-loader";
import {AssetBuilderConfiguratorIdentifiers} from "@labor/asset-building/dist/AssetBuilderConfiguratorIdentifiers";
import {FileHelpers} from "@labor/asset-building/dist/Helpers/FileHelpers";
import {AppDefinitionInterface} from "@labor/asset-building/dist/Interfaces/AppDefinitionInterface";
import {ProcessManager} from "@labor/asset-building/dist/Core/ProcessManager";

export default function (context: WorkerContext, scope: string) {
	if (scope !== "app") throw new Error("The vue extension can not be defined on a global scope!");

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
		if (context.app.useSsr) {
			if (context.app.ssrWorker === "manifest") {
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
						// you should also whitelist deps that modifies `global` (e.g. polyfills)
						whitelist: /\.css$|node_modules/
					})),
					// context.app.useSsrServerExternals ? ((require("webpack-node-externals"))({
					// 		// do not externalize dependencies that need to be processed by webpack.
					// 		// you can add more file types here e.g. raw *.vue files
					// 		// you should also whitelist deps that modifies `global` (e.g. polyfills)
					// 		whitelist: /\.css$/
					// 	})) :
					// 	// Use impossible dummy lookup to keep the server plugin quiet...
					// 	{
					// 		fs: "require('fs')",
					// 		path: "require('path')"
					// 	},

					// This is the plugin that turns the entire output of the server build
					// into a single JSON file. The default file name will be
					// `vue-ssr-server-bundle.json`
					plugins: [
						new (require("vue-server-renderer/server-plugin"))()
					]
				});
			} else if (context.app.ssrWorker === "entry") {
				// Server entry definition
				context.webpackConfig = merge(context.webpackConfig, {
					// This allows webpack to handle dynamic imports in a Node-appropriate
					// fashion, and also tells `vue-loader` to emit server-oriented code when
					// compiling Vue components.
					target: "node",

					// For bundle renderer source map support
					devtool: "source-map",

					// This tells the server bundle to use Node-style exports
					output: {
						libraryTarget: "this"
					}
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
						new (require("vue-server-renderer/client-plugin"))()
					]
				});
			}
		}
	});

	// Set jsx factory in typescript
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_TYPESCRIPT_OPTIONS, (e) => {
		e.args.options.compilerOptions.jsxFactory = "h";
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
		e.args.schema.useAutoSsrServer = {
			type: "bool",
			default: true
		};
		e.args.schema.ssrWorker = {
			type: ["undefined", "string"],
			default: undefined
		};
	});

	// Check if we have to spawn the SSR renderers
	context.eventEmitter.bind(AssetBuilderEventList.AFTER_WORKER_INIT_DONE, (e) => {
		const context: WorkerContext = e.args.context;
		if (context.app.useSsr !== true) return;
		if (context.app.useAutoSsrServer !== true) return;

		// Create our process manager
		const processManager = new ProcessManager(context.eventEmitter);

		// Create the definition for the manifest worker
		// const serverManifestDefinition: AppDefinitionInterface = {
		// 	appName: context.app.appName + " - Server Renderer",
		// 	id: context.app.id + 1000,
		// 	entry: entryFile,
		// 	output: outputFile,
		// 	useSsr: true,
		// 	ssrWorker: "manifest",
		// 	useAutoSsrServer: false,
		// 	polyfills: false,
		// 	keepOutputDirectory: true,
		// 	disableGitAdd: true,
		// 	warningsIgnorePattern: "the request of a dependency is an expression",
		// 	extensions: [
		// 		"@labor/asset-building-env-vuejs"
		// 	]
		// };
		const serverManifestDefinition: AppDefinitionInterface = JSON.parse(JSON.stringify(context.app));
		serverManifestDefinition.appName += " - Server Manifest Generator";
		serverManifestDefinition.id += 1000;
		serverManifestDefinition.useAutoSsrServer = false;
		serverManifestDefinition.minChunkSize = 999999999;
		serverManifestDefinition.polyfills = false;
		serverManifestDefinition.keepOutputDirectory = true;
		serverManifestDefinition.disableGitAdd = true;
		serverManifestDefinition.ssrWorker = "manifest";

		// Create the server manifest worker
		processManager.startSingleWorkerProcess(context.parentContext, serverManifestDefinition)
			.catch((err) => {
				if (typeof err === "string") throw new Error(err);
				throw err;
			});

		// Rewrite the output file
		let outputFile = context.app.output;
		const outputExtension = FileHelpers.getFileExtension(outputFile);
		outputFile = FileHelpers.getFileWithoutExtension(outputFile) + "-server." + outputExtension;

		// Create the definition for the server entry worker
		const serverEntryDefinition: AppDefinitionInterface = {
			appName: context.app.appName + " - Server Entry",
			id: context.app.id + 2000,
			entry: require.resolve("./ServerBundle.js"),
			output: outputFile,
			useSsr: true,
			ssrWorker: "entry",
			useAutoSsrServer: false,
			polyfills: false,
			keepOutputDirectory: true,
			disableGitAdd: true,
			warningsIgnorePattern: "the request of a dependency is an expression",
			extensions: [
				"@labor/asset-building-env-vuejs"
			]
		};

		// Create the server entry worker
		processManager.startSingleWorkerProcess(context.parentContext, serverEntryDefinition)
			.catch((err) => {
				if (typeof err === "string") throw new Error(err);
				throw err;
			});

	});

	// Change the style loader to use the vue style loader
	context.eventEmitter.bind(AssetBuilderEventList.FILTER_LOADER_CONFIG, (e) => {
		// Only inject the vue loader in a development context
		if (context.isProd) return;

		// Skip if the package requires us to use the css extract plugin
		if (context.app.useCssExtractPlugin === true) return;

		// Rewrite sass loader
		if (e.args.identifier === AssetBuilderConfiguratorIdentifiers.SASS_LOADER) {
			e.args.config.use.forEach((v, k) => {
				if (typeof v === "string") v = {loader: v};
				if (typeof v.loader === "undefined") return;

				// Inject vue style loader
				if (v.loader.match(/mini-css-extract-plugin/))
					e.args.config.use[k] = "vue-style-loader";
			});
		}

		// Rewrite less loader
		if (e.args.identifier === AssetBuilderConfiguratorIdentifiers.LESS_LOADER) {
			e.args.config.use.forEach((v, k) => {
				if (typeof v === "string") v = {loader: v};
				if (typeof v.loader === "undefined") return;

				// Inject vue style loader
				if (v.loader.match(/mini-css-extract-plugin/))
					e.args.config.use[k] = "vue-style-loader";
			});
		}
	});
}