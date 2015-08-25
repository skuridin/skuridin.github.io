var Extract = require('extract-text-webpack-plugin');
var Clean = require('clean-webpack-plugin');
var Html = require('html-webpack-plugin');

var plugins = [
  new Extract('dist/style.css'),
  new Html({
    template: './src/template.html',
    hash: true,
    minify: { collapseWhitespace: true }
  })
];

if(process.env.NODE_ENV === 'production') {
  plugins.unshift(new Clean(['dist']));
}

module.exports = {
  context: __dirname + '/src',
  entry: './js/app.jsx',
  output: {
    path: __dirname,
    filename: 'dist/bundle.js',
    publicPath: '/'
  },
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
      },
      {
        test: /\.(jpe?g|png|gif|svg)$/i,
        loaders: [
          'file?name=dist/[name].[ext]',
          'image-webpack?bypassOnDebug&optimizationLevel=7&interlaced=false'
        ]
      }
    ]
  },
  plugins: plugins,
  devServer: {
    host: '0.0.0.0',
    historyApiFallback: true
  }
};
