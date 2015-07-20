var React = require('react');
var Router = require('react-router');
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;
var NotFoundRoute = Router.NotFoundRoute;
var App = require('./components/AppComponent');
var Home = require('./components/pages/HomePageComponent');
var E404 = require('./components/pages/E404PageComponent');

var routes = (
  <Route handler={App}>
    <DefaultRoute handler={Home} name="home" />
    <NotFoundRoute handler={E404} />
  </Route>
);

module.exports = routes;
