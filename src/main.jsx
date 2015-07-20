require('bootstrap/dist/css/bootstrap.css');
require('./style.styl');

var React = require('react');
var Router = require('react-router');
var routes = require('./routes.jsx');

if(typeof(window) !== 'undefined') {
  Router.run(routes, Router.HistoryLocation, function(Handler) {
    React.render(<Handler />, document.getElementById('app'));
  });
}

module.exports = function(path) {
  var result;
  Router.run(routes, path, function(Handler) {
    result = React.renderToString(<Handler />);
  });
  return result;
};
