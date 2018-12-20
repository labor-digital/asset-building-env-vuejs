/**
 * Created by Martin Neundorfer on 18.12.2018.
 * For LABOR.digital
 */
const path = require("path");
module.exports = class VueJsEnvPlugin {
	getEnvironmentHandlers(handlers){
		handlers.set("vuejs", path.resolve(__dirname, "..", "VueJs.js"));
	}

	filterEslintOptions(options, context){
		if(context.environment !== "vuejs") return options;
		delete options.parser;
		options.extends = "vue";
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