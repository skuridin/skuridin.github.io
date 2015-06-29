var HtmlWebpackPlugin = require('html-webpack-plugin'),
    ExtractTextPlugin = require("extract-text-webpack-plugin");

module.exports = {
  context: __dirname + "/src",
  entry: "./main.js",
  output: {
    path: __dirname,
    filename: "bundle.js"
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/template.html',
      title: 'Evgeniy Skuridin',
      hash: true,
      minify: {
        collapseWhitespace: true
      }
    }),
    new ExtractTextPlugin('style.css')
  ],
  module: {
    loaders: [
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract("css!autoprefixer")
      },
      {
        test: /\.styl$/,
        loader: ExtractTextPlugin.extract("css!autoprefixer!stylus")
      },
      {
        test: /\.(png|svg|gif|jpe?g)$/,
        loader: 'file?name=[name]-[hash].[ext]!img?-minimize',
      }
    ]
  }
};
