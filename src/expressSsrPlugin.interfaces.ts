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
 * Last modified: 2020.02.18 at 15:10
 */

import {PlainObject} from "@labor-digital/helferlein/lib/Interfaces/PlainObject";

export interface ExpressSsrPluginStreamWrapperInterface {
	(chunk: string, vueContext: PlainObject): string
}

export interface ExpressSsrPluginVueContextFilterInterfaces {
	(context: PlainObject): void
}

export interface ExpressSsrPluginOptions {
	
	/**
	 * A list of environment variables that should be made public to both your SSR and your browser context
	 * Please make sure that you don't make critical secrets public! You can access the variables on winow.VUE_ENV in the
	 * frontend and on vueContext.VUE_ENV in your SSR app's context
	 */
	envVars?: Array<string>
	
	/**
	 * A list of key value pairs that will be automatically injected into the object at process.vueSsrEnv.
	 * They will be available in your browser app and your ssr context, so be careful!
	 */
	additionalEnvVars?: PlainObject<string | number>
	
	/**
	 * Can be used to modify the vue context object before it is passed to the bundle renderer
	 */
	vueContextFilter?: ExpressSsrPluginVueContextFilterInterfaces;
	
	/**
	 * The stream wrapper will be called on every chunk that is outputted by vues bundle renderer.
	 * It can be used to replace dynamic markers in the html before it is passed to the response object.
	 */
	streamWrapper?: ExpressSsrPluginStreamWrapperInterface;
	
	/**
	 * Allows you to define the regex that is used to whitelist
	 * node_module files that can be build by webpack, everything else is directly loaded
	 * from the node_modules directory on your server.
	 *
	 * Default: /\.css$|\.vue$|[\\\/]src[\\\/]|[\\\/]source[\\\/]/
	 */
	externalWhitelist?: RegExp;
}