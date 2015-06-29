var HtmlWebpackPlugin = require('html-webpack-plugin');

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
    })
  ]
};
