var React = require('react');

var data = [
  { title: 'HTML', label: 'primary' },
  { title: 'CSS', label: 'primary' },
  { title: 'JavaScript', label: 'primary' },
  { title: 'GIT', label: 'warning' },
  { title: 'Grunt', label: 'warning' },
  { title: 'Gulp', label: 'warning' },
  { title: 'PHP', label: 'info' },
  { title: 'RUBY', label: 'info' },
  { title: 'jQuery', label: 'success' },
  { title: 'React', label: 'success' },
  { title: 'Flux', label: 'success' },
  { title: 'MySQL', label: 'default' },
  { title: 'Yii', label: 'default' },
  { title: 'Ruby On Rails', label: 'default' },
  { title: 'Laravel', label: 'default' },
  { title: 'Node', label: 'default' },
  { title: 'Express', label: 'default' }
];

var buildSkill = function(skill) {
  var className = 'label label-' + skill.label;
  return <span className={className} key={skill.idx}>{skill.title}</span>;
};

var SkillsComponent = React.createClass({
  render: function() {
    return (
      <div>
        {data.map(function(skill, idx) {
          skill.idx = idx;
          return buildSkill(skill);
        })}
      </div>
    );
  }
});

module.exports = SkillsComponent;
