// eslint-disable-next-line node/no-extraneous-require
const babelJest = require('babel-jest')

module.exports = babelJest.createTransformer({
	plugins: ['@babel/plugin-transform-modules-commonjs'],
	babelrc: false,
	configFile: false,
})
