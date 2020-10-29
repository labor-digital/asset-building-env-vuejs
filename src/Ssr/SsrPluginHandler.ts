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
 * Last modified: 2020.10.22 at 13:05
 */
import {WorkerContext} from "@labor-digital/asset-building/dist/Core/WorkerContext";
import ExpressContext from "@labor-digital/asset-building/dist/Interop/Express/ExpressContext";
import {PlainObject} from "@labor-digital/helferlein/lib/Interfaces/PlainObject";
import {forEach} from "@labor-digital/helferlein/lib/Lists/forEach";
import {isArray} from "@labor-digital/helferlein/lib/Types/isArray";
import {isObject} from "@labor-digital/helferlein/lib/Types/isObject";
import {isPlainObject} from "@labor-digital/helferlein/lib/Types/isPlainObject";
import {isString} from "@labor-digital/helferlein/lib/Types/isString";
import {isUndefined} from "@labor-digital/helferlein/lib/Types/isUndefined";
import fs from "fs";
import LRU from "lru-cache";
import MemoryFileSystem from "memory-fs";
import path from "path";
import {BundleRenderer, BundleRendererOptions, createBundleRenderer} from "vue-server-renderer";
import {Configuration} from "webpack";
import {ExpressSsrPluginOptions} from "../expressSsrPlugin.interfaces";
import {VueJsEventList} from "../VueJsEventList";
import {SsrResponseHandler} from "./SsrResponseHandler";

export class SsrPluginHandler {
	protected _context: ExpressContext;
	protected _responseHandler: SsrResponseHandler;
	protected _workerContext: WorkerContext;
	protected _options: ExpressSsrPluginOptions;
	protected _renderer: BundleRenderer;
	protected _config: Configuration;
	
	public constructor(context: ExpressContext, options: ExpressSsrPluginOptions) {
		this._context = context;
		this._options = options;
		this._responseHandler = new SsrResponseHandler(this);
	}
	
	public handle(): Promise<ExpressContext> {
		return this.registerGlobalRendererUpdate()
			.then(() => this.initializeWorkerContext())
			.then(() => this.setUpGeneratorConfig())
			.then(() => this.initializeConfiguration())
			.then(() => this.initializeProductionRenderer())
			.then(() => this.registerAssetRoute())
			.then(() => this.registerContentRoute())
			.then(() => this._context);
	}
	
	/**
	 * Returns the set options for the express plugin
	 */
	public get options(): ExpressSsrPluginOptions {
		return this._options;
	}
	
	/**
	 * Returns true if we are running in dev mode -> Meaning we have a parent context
	 */
	public get isDev(): boolean {
		return !isUndefined(this._context.parentContext);
	}
	
	/**
	 * Returns the worker context instance
	 */
	public get workerContext(): WorkerContext {
		if (isUndefined(this._workerContext)) {
			throw new Error("The worker context was not initialized using the initializeWorkerContext() method!");
		}
		return this._workerContext;
	}
	
	/**
	 * Returns the list of all environment variables that will be provided to the frontend
	 */
	public get environmentVariables(): PlainObject {
		const vars: PlainObject = {};
		if (isArray(this._options.envVars)) {
			forEach(this._options.envVars, key => {
				if (isUndefined(process.env[key])) vars[key] = null;
				else vars[key] = process.env[key];
			});
		}
		
		if (isString(process.env.PROJECT_ENV)) {
			vars.PROJECT_ENV = process.env.PROJECT_ENV;
		}
		
		// Add additional, dynamic variables if required
		if (isPlainObject(this._options.additionalEnvVars)) {
			forEach(this._options.additionalEnvVars, (v, k) => {
				vars[k] = v;
			});
		}
		
		return vars;
	}
	
	/**
	 * Returns the bundle renderer instance
	 */
	public get renderer(): BundleRenderer {
		if (isUndefined(this._renderer)) {
			throw new Error("The renderer instance was not instantiated yet!");
		}
		return this._renderer;
	}
	
	/**
	 * Registers the ssr renderer update handler on the global scope when running in a development environment
	 * @protected
	 */
	protected registerGlobalRendererUpdate(): Promise<this> {
		if (!this.isDev) {
			return Promise.resolve(this);
		}
		
		let template = null;
		let bundle = null;
		let clientManifest = undefined;
		
		// Register global render generation
		global.EXPRESS_VUE_SSR_UPDATE_RENDERER = (type: "template" | "bundle" | "clientManifest", value: string) => {
			try {
				if (type === "template") {
					template = value;
					if (bundle !== null) {
						this._renderer = this.createRenderer(bundle, template, clientManifest);
					}
				} else if (type === "bundle") {
					bundle = value;
					if (template !== null) {
						this._renderer = this.createRenderer(bundle, template, clientManifest);
					}
				} else if (type === "clientManifest") {
					clientManifest = JSON.parse(value);
				}
			} catch (e) {
				console.log(e);
				process.exit(1);
			}
		};
		
		// Register callback when the compiler is done
		this._context.compiler.hooks.done.tap("ExpressSsrPlugin", () => {
			const mfs: MemoryFileSystem = this._context.compiler.outputFileSystem as any;
			
			// Update the client manifest
			const clientManifestPath = path.join(this._config.output.path, "vue-ssr-client-manifest.json");
			if (mfs.existsSync(clientManifestPath))
				global.EXPRESS_VUE_SSR_UPDATE_RENDERER("clientManifest", mfs.readFileSync(clientManifestPath).toString("utf-8"));
			
			// Update the template
			const indexFilePath = path.join(this._config.output.path, "index.html");
			if (mfs.existsSync(indexFilePath))
				global.EXPRESS_VUE_SSR_UPDATE_RENDERER("template", mfs.readFileSync(indexFilePath).toString("utf-8"));
		});
		
		return Promise.resolve(this);
	}
	
	/**
	 * Makes sure that the worker context is initialized and ready for action
	 */
	protected initializeWorkerContext(): Promise<this> {
		if (!this.isDev) {
			return this._context.factory.getWorkerContext().then(c => {
				this._workerContext = c;
				return this;
			});
		}
		this._workerContext = this._context.parentContext;
		return Promise.resolve(this);
	}
	
	/**
	 * Updates the config generator to match the configured options
	 * @protected
	 */
	protected setUpGeneratorConfig(): Promise<this> {
		if (this.isDev) {
			
			// Register the external allow list update if configured
			if (isObject(this._options.externalAllowList)) {
				this.workerContext.eventEmitter.bind(VueJsEventList.SSR_EXTERNAL_ALLOW_LIST_FILTER, (e) => {
					e.args.allowList = this._options.externalAllowList;
				}, -500);
			}
		}
		
		return Promise.resolve(this);
	}
	
	/**
	 * Makes sure that the webpack config is ready to be used
	 * @protected
	 */
	protected initializeConfiguration(): Promise<this> {
		if (this.isDev) {
			this._config = this._context.parentContext.webpackConfig;
			return Promise.resolve(this);
		}
		
		return this.workerContext.do.makeConfiguration().then(config => {
			this._config = config;
			return this;
		});
	}
	
	/**
	 * Makes sure that the renderer is initialized in the production environment
	 * @protected
	 */
	protected initializeProductionRenderer(): Promise<this> {
		if (!this.isDev) {
			const serverBundle = require(path.resolve(this._config.output.path, "./vue-ssr-server-bundle.json"));
			const clientManifest = require(path.resolve(this._config.output.path, "./vue-ssr-client-manifest.json"));
			const template = fs.readFileSync(path.resolve(this._config.output.path, "./index.html"), "utf-8");
			this._renderer = this.createRenderer(serverBundle, template, clientManifest);
		}
		return Promise.resolve(this);
	}
	
	/**
	 * Registers the express route to our generated assets
	 * @protected
	 */
	protected registerAssetRoute(): Promise<this> {
		this._context.registerPublicAssets(this._config.output.path, this._config.output.publicPath.replace(/^\./, ""));
		return Promise.resolve(this);
	}
	
	/**
	 * Registers the main catch-all express route where the bundle renderer responds to the request
	 * @protected
	 */
	protected registerContentRoute(): Promise<this> {
		this._context.expressApp.get("*",
			(req, res) => this._responseHandler.handle(req as any, res)
		);
		return Promise.resolve(this);
	}
	
	/**
	 * Internal helper to recreate the bundle renderer instance when webpack rebuilt the definition
	 * @param bundle
	 * @param template
	 * @param clientManifest
	 */
	protected createRenderer(bundle, template, clientManifest?) {
		const options: BundleRendererOptions = {
			runInNewContext: this.isDev ? true : "once",
			template,
			clientManifest,
			// Don't inject the styles in dev mode to prevent
			// issues (duplicate style tags) when using hot reloading
			inject: !this.isDev
		};
		if (!this.isDev) options.cache = new LRU({
			max: 1000,
			maxAge: 1000 * 60 * 15
		});
		return createBundleRenderer(bundle, options);
	}
}