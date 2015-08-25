var React = require('react');

var lines = [
  'Hi! My name is Evgeniy',
  'Front End developer',
  'Tashkent, Uzbekistan',
  'Ready to relocate'
];

var AboutMeComponent = React.createClass({
  render: function() {
    return (
      <ul className="about-me">
        {lines.map(function(line, idx) {
          return <li className="about-me__line" key={idx}>{line}</li>;
        })}
      </ul>
    );
  }
});

module.exports = AboutMeComponent;
