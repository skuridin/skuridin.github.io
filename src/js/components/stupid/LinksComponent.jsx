var React = require('react');

var links = [
  ['CV', 'Evgeniy.Skuridin.Frontend.pdf'],
  ['Github', 'https://github.com/skuridin'],
  ['Email', 'mailto:i@skurid.in'],
  ['Skype', 'skype:redfield1990?add']
];

var LinksComponent = React.createClass({
  render: function() {
    return (
      <div className="links">
        {links.map(function(link, idx) {
          return <a href={link[1]} className="links__item"
            key={idx}>{link[0]}</a>;
        })}
      </div>
    );
  }
});

module.exports = LinksComponent;
