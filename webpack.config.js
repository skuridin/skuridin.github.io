var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');
var Clean = require('clean-webpack-plugin');
var htmlFileName = 'index.html';

if(process.env.NODE_ENV === 'production') htmlFileName = 'template.html';

module.exports = {
  context: __dirname + '/src',
  entry: './main.jsx',
  output: {
    path: __dirname,
    filename: 'assets/bundle.js',
    libraryTarget: 'umd',
    publicPath: '/'
  },
  resolve: {
    extensions: ['', '.webpack.js', '.web.js', '.js', '.jsx']
  },
  plugins: [
    new Clean(['assets', './*.html']),
    new ExtractTextPlugin('assets/style.css'),
    new webpack.DefinePlugin({
      NODE_ENV: JSON.stringify(process.env.NODE_ENV)
    }),
    new HtmlWebpackPlugin({
      template: './src/template.html',
      filename: htmlFileName,
      title: 'Evgeniy Skuridin',
      favicon: 'favicon.ico',
      hash: true,
      minify: {
        collapseWhitespace: true
      }
    })
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
  }
};
