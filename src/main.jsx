require('bootstrap/dist/css/bootstrap.css');
require('./style.styl');

var React = require('react');
var Router = require('react-router');
var routes = require('./routes.jsx');

if(typeof(window) !== 'undefined') {
  Router.run(routes, Router.HashLocation, function(Handler) {
    React.render(<Handler />, document.getElementById('app'));
  });
}

var renderToString = function() {
  var result;
  Router.run(routes, '/', function(Handler) {
    result = React.renderToString(<Handler />);
  })
  return result;
};

module.exports = renderToString;
