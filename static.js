var fs = require('fs');
var renderToString = require('./assets/bundle.js');
var template = __dirname + '/index.html';
var markup = fs.readFileSync(template, 'utf8');
var reactResult = renderToString('/');

markup = markup.replace('{react}', reactResult);
fs.writeFileSync(template, markup);
