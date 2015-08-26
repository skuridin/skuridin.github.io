require('normalize.css');
require('../css/app.styl');

var React = require('react');
var canUseDOM =  require('react/lib/ExecutionEnvironment').canUseDOM;
var Router = require('react-router');
var routes = require('./routes');

if(canUseDOM) {
  Router.run(routes, Router.HistoryLocation, function(Handler) {
    React.render(<Handler />, document.getElementById('app'));
  });
}

module.exports = function(path, cb) {
  Router.run(routes, path, function(Handler) {
    cb(React.renderToStaticMarkup(<Handler/>));
  });
};
