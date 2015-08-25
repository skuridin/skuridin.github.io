module.exports = {
  context: __dirname + '/src',
  entry: './js/app.jsx',
  target: 'node',
  output: {
    path: __dirname,
    filename: 'dist/server.js',
    publicPath: '/',
    libraryTarget: 'commonjs2',

  },
  resolve: { extensions: ['', '.webpack.js', '.web.js', '.js', '.jsx'] },
  externals: /^[a-z\-0-9]+$/,
  module: {
    loaders: [
      { test: /\.jsx?$/, exclude: /node_modules/, loader: 'babel' },
      { test: /\.(styl|css)?$/, loader: 'null' },
      { test: /\.(jpe?g|png|gif|svg)$/i, loader: 'null' }
    ]
  }
};
