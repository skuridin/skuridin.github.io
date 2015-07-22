var React = require('react');
var data = require('../data/career');

var CareerComponent = React.createClass({
  render: function() {
    return (
      <div>
        {data.map(function(career, idx) {
          return (
            <div className="cv-career-item" key={idx}>
              <h4>{career.title}</h4>
              <h5>{career.position} <small>{career.period}</small></h5>
              <p>{career.text}</p>
            </div>
          );
        })}
      </div>
    );
  }
});

module.exports = CareerComponent;
