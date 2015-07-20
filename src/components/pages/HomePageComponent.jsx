var React = require('react');
var Link = require('react-router').Link;

var HomeComponent = React.createClass({
  render: function() {
    return (
      <div className="wrapper-table">
        <div className="wrapper-cell">
          <div className="wrapper">
            <div className="home-page">
              <img className="home-page-logo" src={require('../../images/logo.svg')} alt="Evgeniy Skuridin" />
              <div className="home-page-info">
                Hi! My name is Evgeniy. <br />
                Frontend developer. <br />
                Tashkent, Uzbekistan. <br />
                Ready to relocate.
              </div>
              <div className="home-page-links">
                <Link to="cv">CV</Link>
                <a href="https://github.com/skuridin">Github</a>
                <a href="mailto:i@skurid.in">Email</a>
                <a href="skype:redfield1990?chat">Skype</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
});

module.exports = HomeComponent;
