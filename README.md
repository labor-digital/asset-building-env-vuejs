# LABOR Asset Building - Vue.js Environment
This package provides you with everything you need to use vue.js in our webpack pipeline.
Uses vue-loader to support single file components, prepares eslint for vue and sets up the required style loaders.

You should also consider installing the asset-building-dev-server package to get the most out of your local development experience

## Installation
* Use our private npm registry!
* Install our asset builder
`` npm install --save-dev @labor/asset-building ``
* Install the npm dependency
`` npm install --save-dev @labor/asset-building-env-vuejs``
* Add the provider plugin to your package.json
```
{ 
    "builderVersion": 2,
    "apps": [
    	[...]
    	{
    		"environment": "vuejs"
    		[...]
    	}
    ]
}
```
* Done! :-)

## Options
####useCssExtractPlugin
By default the "mimiCssExtract" plugin will be disabled in order to allow hot reloading for the vue components. 
If you are using a legacy project in combination with vue, you may set this to FALSE. In that case, all css files will be dumped, even if in development.

```
{
    "labor": {
        "apps": [
            {
                ...
                "useCssExtractPlugin": false,
                ...
            }
        ]
    }
}
```