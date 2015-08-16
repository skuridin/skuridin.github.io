var Extract = require('extract-text-webpack-plugin');
var Clean = require('clean-webpack-plugin');
var Html = require('html-webpack-plugin');

module.exports = {
  context: __dirname + '/src',
  entry: './js/app.jsx',
  output: { path: __dirname, filename: 'dist/bundle.js' },
  resolve: { extensions: ['', '.webpack.js', '.web.js', '.js', '.jsx'] },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        loader: 'babel'
      },
      {
        test: /\.(styl|css)?$/,
        loader: Extract.extract('css!autoprefixer!stylus')
      }
    ]
  },
  plugins: [
    new Clean(['dist']),
    new Extract('dist/style.css'),
    new Html()
  ]
};
