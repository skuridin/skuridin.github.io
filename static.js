var fs = require('fs');
var renderToString = require('./assets/bundle.js');
var template = __dirname + '/template.html';
var markup = fs.readFileSync(template, 'utf8');
var pages = [
  { path: '/', file: 'index.html' },
  { path: '/cv.html', file: 'cv.html' }
];

pages.forEach(function(page) {
  console.log('Page "' + page.path + '"');
  var reactResult = renderToString(page.path);
  var savePath = __dirname + '/' + page.file;
  reactResult = markup.replace('{react}', reactResult);
  fs.writeFileSync(savePath, reactResult);
});
