var React = require('react');
var data = [
  'HTML', 'CSS', 'JavaScript', 'PHP', 'Ruby', 'Git', 'Webpack', 'Gulp', 'Grunt',
  'React', 'Flux',  'jQuery', 'Stylus', 'Less', 'SCSS', 'Yii', 'Ruby On Rails'
];

var SkillsComponent = React.createClass({
  render: function() {
    return (
      <div>
        {data.map(function(skill, idx) {
          return <span className="label label-default" key={idx}>{skill}</span>;
        })}
      </div>
    );
  }
});

module.exports = SkillsComponent;
