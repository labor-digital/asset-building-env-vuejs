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
import {isFunction} from "@labor-digital/helferlein/lib/Types/isFunction";
import {isPlainObject} from "@labor-digital/helferlein/lib/Types/isPlainObject";
import {ExpressSsrPluginOptions} from "./expressSsrPlugin.interfaces";
import {SsrPluginHandler} from "./Ssr/SsrPluginHandler";

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
	
	return (new SsrPluginHandler(context, options)).handle();
};

/**
 * A wrapper to add additional configuration options to the plugin
 * @param {ExpressSsrPluginOptions} options
 */
module.exports.configure = function (options: ExpressSsrPluginOptions): Function {
	return (context) => module.exports(context, options);
};

