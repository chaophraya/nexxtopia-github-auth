module.exports = {
    devtool: 'source-maps',
    entry: './index',
    output: {
        libraryTarget: 'umd',
        path: './dist/',
        filename: 'sinopia2-github-auth.min.js',
        library: 'sinopia2-github-auth'
    },
    resolve: {
        modulesDirectories: ['node_modules'],
        alias: {}
    },
    module: {
        loaders: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                loader: 'babel'
            },
            {
                test: /\.json$/,
                loader: 'json'
            }
        ]
    },
    preLoaders: [{
        test: /\.js?$/,
        exclude: /node_modules/,
        loaders: ['eslint']
    }],
    externals: {}
};
