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
};