require('bootstrap/dist/css/bootstrap.css');
require('./style.styl');

var React = require('react');
var Router = require('react-router');
var routes = require('./routes.jsx');
var Location = Router.HashLocation;

if(typeof(window) !== 'undefined') {
  if(NODE_ENV === 'production') Location = Router.HistoryLocation;
  Router.run(routes, Location, function(Handler) {
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
