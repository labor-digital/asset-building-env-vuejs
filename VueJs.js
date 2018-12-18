/**
 * Created by Martin Neundorfer on 13.12.2018.
 * For LABOR.digital
 */
const merge = require("webpack-merge");
const VueLoaderPlugin = require("vue-loader/lib/plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

/**
 * Prepares the webpack config for a vue js environment
 */
module.exports = class VueJs {
	/**
	 *
	 * @param {module.ConfigBuilderContext} context
	 */
	apply(context) {
		const webpackConfig = context.webpackConfig;

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

		// Disable node module inejctions
		context.webpackConfig = merge(webpackConfig, {
			resolve: {
				extensions: [".vue", ".tsx"]
			},
			node: {
				// prevent webpack from injecting useless setImmediate polyfill because Vue
				// source contains it (although only uses it if it's native).
				setImmediate: false,
				// prevent webpack from injecting mocks to Node native modules
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

		// Disalbe component loader
		context.currentAppConfig.componentLoader = false;

		// Add style loaders
		this._applyStyleLoaders(context);
	}

	isComponentEnabled(state, component) {
		// Disalbe default style loaders
		if (component === "SassLoader" || component === "LessLoader") return false;
		return state;
	}

	/**
	 * Applies additional style loader required for vue to work propperly with sass and less
	 * @param {module.ConfigBuilderContext} context
	 * @private
	 */
	_applyStyleLoaders(context) {
		context.webpackConfig.module.rules.push({
			test: /\.scss$/,
			use: [
				context.isProd ? MiniCssExtractPlugin.loader : "vue-style-loader",
				"css-loader",
				"sass-loader"
			]
		});
		context.webpackConfig.module.rules.push({
			test: /\.sass$/,
			use: [
				context.isProd ? MiniCssExtractPlugin.loader : "vue-style-loader",
				"css-loader",
				{
					loader: "sass-loader",
					options: {
						indentedSyntax: true
					}
				}
			],

		});
		context.webpackConfig.module.rules.push({
			test: /\.css$/,
			use: [
				context.isProd ? MiniCssExtractPlugin.loader : "vue-style-loader",
				"css-loader"
			]
		});
		context.webpackConfig.module.rules.push({
			test: /\.less$/,
			use: [
				context.isProd ? MiniCssExtractPlugin.loader : "vue-style-loader",
				"css-loader",
				"less-loader"
			]
		});
	}
};