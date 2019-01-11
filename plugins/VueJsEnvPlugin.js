/**
 * Created by Martin Neundorfer on 18.12.2018.
 * For LABOR.digital
 */
const path = require("path");
const EsLintConfig_Typescript = require("@labor/asset-building/src/LintConfig/EsLintConfig_Typescript");

module.exports = class VueJsEnvPlugin {
	getEnvironmentHandlers(handlers){
		handlers.set("vuejs", path.resolve(__dirname, "..", "VueJs.js"));
	}

	afterComponent(context, componentKey){
		if(context.environment !== "vuejs") return context;
		if(componentKey === "EsLint") this._injectVueEsLint(context);
	}

	_injectVueEsLint(context){

		// Extend typescript default config
		const lintConfig = new EsLintConfig_Typescript(context);
		lintConfig.parser = "vue-eslint-parser";
		lintConfig.extends = [
			"eslint:recommended",
			"plugin:vue/recommended",
			"typescript"
		];
		if(typeof lintConfig.parserOptions === "undefined") lintConfig.parserOptions = {};
		lintConfig.parserOptions.parser = "typescript-eslint-parser";

		// Prepare exclude pattern
		const baseExcludePattern = /node_modules(?![\\/\\\\]@labor[\\/\\\\])/;
		const excludePattern = context.callPluginMethod("filterExcludePattern", [
			context.builderVersion === 1 ? baseExcludePattern : undefined,
			"esLint", baseExcludePattern, context
		]);

		// Inject new lint loader
		context.webpackConfig.module.rules.push(
			context.callPluginMethod("filterLoaderConfig", [
				{
					test: context.callPluginMethod("filterLoaderTest", [/\.vue$/, "vueLintLoader", context]),
					exclude: excludePattern === null ? undefined : excludePattern,
					enforce: "pre",
					use: [
						{
							loader: "eslint-loader",
							options: context.callPluginMethod("filterEslintOptions", [
								lintConfig, context, "vue"])
						}
					]
				},
				"vueLintLoader", context
			]));
	}

	filterExcludePattern(pattern, type, basePattern, context){
		// Make sure that the eslint excludes everything in node_modules
		if(context.environment !== "vuejs" || type !== "esLint") return pattern;
		return basePattern;
	}

	filterLoaderConfig(config, type, context){
		// Only inject the vue loader in a development context
		if(context.isProd) return config;

		// Rewrite sass loader
		if(type === "sassLoader"){
			config.use.forEach((v, k) => {
				if(typeof v === "string") v = {loader: v};
				if(typeof v.loader === "undefined") return;

				// Inject vue style loader
				if(v.loader.match(/mini-css-extract-plugin/))
					config.use[k] = "vue-style-loader";
			});
		}

		// Rewrite less loader
		if(type === "lessLoader"){
			config.use.forEach((v, k) => {
				if(typeof v === "string") v = {loader: v};
				if(typeof v.loader === "undefined") return;

				// Inject vue style loader
				if(v.loader.match(/mini-css-extract-plugin/))
					config.use[k] = "vue-style-loader";
			});
		}
	}

	customSassLoaderFileExtensionFallback(ext, stylesheetPath, resourceQuery){
		// Help out with single file components
		if(ext !== "vue") return ext;
		if(resourceQuery.match(/&lang=sass/)) return "sass";
		if(resourceQuery.match(/&lang=scss/)) return "scss";
		if(resourceQuery.match(/&type=style/) && resourceQuery.match(/&type=.*?/) === null) return "css";
		return ext;
	}
};