var React = require('react');
var DocumentTitle = require('react-document-title');
var AboutMe = require('../stupid/AboutMeComponent');
var Links = require('../stupid/LinksComponent');

var HomePageComponent = React.createClass({
  render: function() {
    return (
      <DocumentTitle title="Evgeniy Skuridin — Front End Developer">
        <div className="wrapper">
          <div className="wrapper-cell">
            <div className="wrapper-content">
              <div className="home-page">
                <img className="logo" src={require('../../../img/logo.png')} alt="ES" />
                <AboutMe />
                <Links />
              </div>
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
});

module.exports = HomePageComponent;
