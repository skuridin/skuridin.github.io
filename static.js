var render = require('./dist/bundle');
render('/', function(result) {
  console.log(result);
});
