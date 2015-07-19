var React = require('react');
var RouteHandler = require('react-router').RouteHandler;

var AppComponent = React.createClass({
  render: function() {
    return <RouteHandler />;
  }
});

module.exports = AppComponent;
