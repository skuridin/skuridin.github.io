var React = require('react');
var data = [
  'HTML', 'CSS', 'JavaScript', 'GIT', 'Grunt', 'Gulp', 'PHP', 'Ruby',
  'jQuery', 'React', 'Flux', 'SCSS', 'Stylus', 'Less', 'MySQL', 'Yii',
  'Ruby on Rails', 'Laravel', 'Node', 'Express'
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
