var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var Clean = require('clean-webpack-plugin');

module.exports = {
  context: __dirname + '/src',
  entry: './app.js',
  output: {
    path: __dirname,
    filename: 'assets/bundle.js'
  },
  plugins: [
    new Clean(['assets', './*.html']),
    new ExtractTextPlugin('assets/style.css'),
    new HtmlWebpackPlugin({
      template: './src/template.html',
      title: 'Evgeniy Skuridin — Front End Developer',
      favicon: 'favicon.ico',
      hash: true,
      minify: {
        collapseWhitespace: true
      }
    })
  ],
  module: {
    loaders: [
      {
        test: /\.styl$/,
        loader: ExtractTextPlugin.extract('css!autoprefixer!stylus')
      },
      {
        test: /\.hbs$/,
        loader: 'handlebars'
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loaders: [
            'file?name=assets/[name].[ext]',
            'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ]
      }
    ]
  }
};
