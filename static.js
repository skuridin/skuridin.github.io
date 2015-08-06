var fs = require('fs');
var minify = require('html-minifier').minify;
var Handlebars = require('handlebars');
var content = require('./assets/bundle');
var template = __dirname + '/index.html';
var markup = fs.readFileSync(template, 'utf8');
markup = Handlebars.compile(markup);
markup = markup({ content: minify(content, { collapseWhitespace: true }) });
fs.writeFileSync(template, markup);
