const path = require('path');
const fs = require('fs');

module.exports = {
    entry: './index.js',
    target: 'node',
    output: {
        libraryTarget: 'commonjs2',
        path: path.join(__dirname, 'dist', 'server'),
        filename: 'sinopia2-github-auth.min.js'
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel'
            }
        ]
    },
    preLoaders: [{
        test: /\.js?$/,
        exclude: path.join(__dirname, 'node_modules'),
        loaders: ['eslint']
    }],
    externals: {}
};
