var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var Clean = require('clean-webpack-plugin');

module.exports = {
  context: __dirname + '/src',
  entry: './main.jsx',
  output: {
    path: __dirname,
    filename: 'assets/bundle.js',
    libraryTarget: 'umd'
  },
  resolve: {
    extensions: ['', '.webpack.js', '.web.js', '.js', '.jsx']
  },
  plugins: [
    new Clean('assets'),
    new HtmlWebpackPlugin({
      template: './src/template.html',
      filename: 'template.html',
      title: 'Evgeniy Skuridin',
      favicon: 'favicon.ico',
      hash: true,
      minify: {
        collapseWhitespace: true
      }
    }),
    new ExtractTextPlugin('assets/style.css')
  ],
  module: {
    loaders: [
      { test: /\.jsx$/, loader: 'babel' },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('css!autoprefixer')
      },
      {
        test: /\.styl$/,
        loader: ExtractTextPlugin.extract('css!autoprefixer!stylus')
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loaders: [
            'file?name=assets/[name].[ext]',
            'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ]
      },
      {
        test: /\.(eot|ttf|woff|woff2)$/i,
        loader: 'file?name=assets/[name].[ext]'
      },
    ]
  },
  devServer: {
    historyApiFallback: true
  }
};
