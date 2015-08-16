var React = require('react');
var Router = require('react-router');
var Route = Router.Route;
var DefaultRoute = Router.DefaultRoute;
var App = require('./components/stupid/AppComponent');
var Home = require('./components/pages/HomePageComponent');

module.exports = (
  <Route handler={App} path="/">
    <DefaultRoute handler={Home} name="home" />
  </Route>
);
