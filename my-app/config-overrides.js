const webpack = require('webpack');

module.exports = function override(config) {
  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    vm: require.resolve('vm-browserify'),
    zlib: require.resolve('browserify-zlib'),
    querystring: require.resolve('querystring-es3'),
    path: require.resolve('path-browserify'),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    http: require.resolve('stream-http'),
    fs: false,
    net: false,
    async_hooks: false,
  };

  // Add plugins for process and Buffer polyfills
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    })
  );

  // Suppress critical dependency warnings
  config.ignoreWarnings = [/Critical dependency:/];

  return config;
};