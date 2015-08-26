var fs = require('fs');
var template = __dirname + '/template.html';
var render = require('./dist/bundle');
var markup = fs.readFileSync(template, 'utf-8');
render('/', function(result, pageTitle) {
  markup = markup.replace('{react}', result);
  markup = markup.replace('{pageTitle}', pageTitle);
  fs.writeFileSync(__dirname + '/index.html', markup);
});
