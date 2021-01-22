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
 * Last modified: 2020.10.22 at 13:32
 */

import {isFunction} from "@labor-digital/helferlein/lib/Types/isFunction";
import {Response} from "express";
import {BundleRenderer} from "vue-server-renderer";
import {SsrPluginHandler} from "./SsrPluginHandler";

export class SsrResponseHandler {
	protected _pluginHandler: SsrPluginHandler;
	
	public constructor(pluginHandler: SsrPluginHandler) {
		this._pluginHandler = pluginHandler;
	}
	
	/**
	 * Handles the ssr request using the vue bundle renderer
	 * @param req
	 * @param res
	 */
	public handle(req: Request, res: Response) {
		if (!this.hasRenderer) {
			return res.end("Waiting for compilation... Refresh in a moment.");
		}
		
		const s = Date.now();
		res.setHeader("Content-Type", "text/html");
		
		// Create the rendering stream
		const vueContext = {
			url: req.url,
			serverRequest: req,
			serverResponse: res,
			env: this._pluginHandler.environmentVariables,
			afterRendering: null
		};
		if (isFunction(this._pluginHandler.options.vueContextFilter)) {
			this._pluginHandler.options.vueContextFilter(vueContext);
		}
		const stream = this.renderer.renderToStream(vueContext);
		
		// Apply meta data by the "vue-meta" plugin
		stream.on("data", (chunk: Buffer) => {
			res.write(
				this._pluginHandler.options.streamWrapper(
					this.applyRendererMetaData(
						vueContext,
						this.applyMetaData(
							vueContext,
							chunk.toString("utf-8")
						)
					),
					vueContext
				)
			);
		});
		
		// End the response when the stream ends
		stream.on("end", () => {
			const cb = function () {
				console.log(`Request duration: ${Date.now() - s}ms`);
				res.end();
			};
			
			if (isFunction(vueContext.afterRendering)) {
				vueContext.afterRendering(res).then(cb);
			} else {
				cb();
			}
		});
		
		// Handle errors
		stream.on("error", err => {
			// Render Error Page or Redirect
			res.status(500).end("500 | Internal Server Error");
			console.error(`Error during render : ${req.url}`);
			console.error(err);
		});
	}
	
	/**
	 * Returns true if the bundle renderer is initialized, false if not
	 * @protected
	 */
	protected get hasRenderer(): boolean {
		try {
			this._pluginHandler.renderer;
			return true;
		} catch (e) {
			console.log(e);
			return false;
		}
	}
	
	/**
	 * Returns the vue bundle renderer instance
	 * @protected
	 */
	protected get renderer(): BundleRenderer {
		return this._pluginHandler.renderer;
	}
	
	/**
	 * Internal helper to inject only the scripts and the state into the build chunks.
	 * This avoids issues when the hot reload plugin and the bundle renderer start to fight over
	 * the priority of css rules.
	 *
	 * @param vueContext
	 * @param chunk
	 */
	protected applyRendererMetaData(vueContext, chunk: string): string {
		const that = this;
		chunk = chunk.replace(/<!--vue-renderer-head-outlet-->/g, function () {
			if (!that._pluginHandler.isDev) {
				return "";
			}
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
	protected applyMetaData(vueContext, chunk: string): string {
		const nl = "\r\n";
		
		// Inject the environment variables
		const jsonEnv = JSON.stringify(vueContext.env);
		const envScript = "<script type='text/javascript'>window.VUE_ENV = " + jsonEnv + ";</script>";
		chunk = chunk.replace(/<!--vue-head-outlet-->/g, () => "<!--vue-head-outlet-->" + nl + envScript);
		
		// Check if we should inject additional metadata
		if (typeof vueContext.meta === "undefined") {
			return chunk;
		}
		
		const {
			title, htmlAttrs, headAttrs, bodyAttrs, link,
			style, script, noscript, meta
		} = vueContext.meta.inject();
		
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
}