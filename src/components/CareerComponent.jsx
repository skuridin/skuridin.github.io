var React = require('react');
var data = require('../data/career');

var CareerComponent = React.createClass({
  render: function() {
    return (
      <div className="row">
        {data.map(function(career, idx) {
          return (
            <div className="cv-career-item col-md-6" key={idx}>
              <h4>{career.title}</h4>
              <h5>{career.position} <small>{career.period}</small></h5>
              <ul className="cv-career-content">
                {career.content.map(function(item, idx) {
                  return <li key={idx}>{item}</li>;
                })}
              </ul>
            </div>
          );
        })}
      </div>
    );
  }
});

module.exports = CareerComponent;
