# Change Log

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.3.2](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v2.3.2%0Dv2.3.1#diff) (2019-10-28)


### Bug Fixes

* fix for broken public path ([81f5782](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/81f5782))



## [2.3.1](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v2.3.1%0Dv2.3.0#diff) (2019-10-27)


### Bug Fixes

* fix for broken output path ([9e6b3a1](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/9e6b3a1))



# [2.3.0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v2.3.0%0Dv2.2.0#diff) (2019-10-23)


### Features

* add vue-meta support for the ssr renderer ([fad58f7](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/fad58f7))



# [2.2.0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v2.2.0%0Dv2.1.0#diff) (2019-10-22)


### Features

* automatically enable htmlTemplate if SSR mode is active ([0590fd4](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/0590fd4))
* implement status code bridge to the vue rendering package ([6465ac0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/6465ac0))



# [2.1.0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v2.1.0%0Dv2.0.0#diff) (2019-10-15)


### Features

* finalize SSR implementation using the latest asset-builder version ([a74b305](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/a74b305))



# [2.0.0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v2.0.0%0Dv1.3.0#diff) (2019-10-11)


### Bug Fixes

* update dependencies ([0ebb85f](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/0ebb85f))


### Features

* update for latest asset builder version ([b73b03e](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/b73b03e))


### BREAKING CHANGES

* This package is no longer compatible with asset builder
v3



# [1.3.0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v1.3.0%0Dv1.2.0#diff) (2019-09-25)


### Features

* update dependencies ([a30979b](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/a30979b))



# [1.2.0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v1.2.0%0Dv1.1.1#diff) (2019-08-01)


### Features

* add useCssExtractPlugin toggle + add support for jsx/tsx templates ([c5ee2d6](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/c5ee2d6))
* update dependencies ([e1023ad](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/e1023ad))



## [1.1.1](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v1.1.1%0Dv1.1.0#diff) (2019-07-01)


### Bug Fixes

* try to fix wrong vue versions in projects ([09f50e5](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/09f50e5))



# [1.1.0](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/branches/compare/v1.1.0%0Dv1.0.8#diff) (2019-06-13)


### Features

* update dependencies and add pipeline support ([8935ed4](https://bitbucket.org/labor-digital/labor-dev-assetbuilding-env-vuejs/commits/8935ed4))



## [1.0.8] - 2019-02-06
### Changed
- Converted all dependency versions to absolute numbers

## [1.0.7] - 2019-02-06
### Removed
- Removed no longer needed dependencies

## [1.0.6] - 2019-02-06
### Removed
- Removed some no longer required Hooks for customSassLoader and esLint

## [1.0.5] - 2019-01-30
### Changed
- Updated dependencies to their latest versions

## [1.0.4] - 2019-01-14
### Changed
- Added vue as dependency so we can be sure we always have the same version of vue and the template compiler
- Updated dependencies

## [1.0.3] - 2019-01-11
### Fixed
- Fixed an issue where the eslint parserOptions were overwritten by our config

## [1.0.2] - 2019-01-10
### Fixed
- Fixed an issue with the eslint implementation for vue files

## [1.0.1] - 2018-12-20
### Added
- Added a workaround to make sure sass resources get loaded like in the default behaviour
- Added sass loader file extension helper 

### Changed
- Switched style loaders back to the default variants, thanks to better plugin integration

## [1.0.0] - 2018-12-18
Initial commit

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).
