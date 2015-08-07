require('./style.styl');
var homeTemplate = require('./home.hbs');

var page = {
  title: 'Evgeniy Skuridin — Front End Developer',
  image: require('./images/logo.png'),
  info: [
    'Hi! My name is Evgeniy',
    'Frontend developer',
    'Tashkent, Uzbekistan',
    'Ready to relocate'
  ],
  links: [
    { title: 'CV', url: 'Evgeniy.Skuridin.Frontend.pdf' },
    { title: 'Github', url: 'https://github.com/skuridin' },
    { title: 'Email', url: 'mailto:i@skurid.in' },
    { title: 'Skype', url: 'skype:redfield1990?chat' },
  ]
};

var result = homeTemplate(page);

if(typeof window !== 'undefined') {
  document.getElementById('app').innerHTML = result;
}

module.exports = result;
