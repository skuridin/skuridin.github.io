var fs = require('fs');
var template = __dirname + '/template.html';
var render = require('./dist/bundle');
var markup = fs.readFileSync(template, 'utf-8');
render('/', function(result) {
  markup = markup.replace('{react}', result);
  fs.writeFileSync(__dirname + '/index.html', markup);
});
