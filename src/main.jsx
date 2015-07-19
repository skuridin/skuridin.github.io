require('bootstrap/dist/css/bootstrap.css');
require('./style.styl');

var React = require('react');
var Router = require('react-router');
var routes = require('./routes.jsx');

Router.run(routes, Router.HashLocation, function(Handler) {
  React.render(<Handler />, document.getElementById('app'));
});
