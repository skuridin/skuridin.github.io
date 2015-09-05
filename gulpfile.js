var gulp = require('gulp');
var postcss = require('gulp-postcss');
var cssnano = require('cssnano');
var cssImport = require('postcss-import');
var htmlMin = require('gulp-htmlmin');

gulp.task('css', function() {
  var processors = [cssImport, cssnano];
  var autoprefixerOptions = { browsers: ['last 2 versions', 'ie >= 8'] };
  gulp.src('./src/style.css')
    .pipe(postcss(processors, { autoprefixer: autoprefixerOptions }))
    .pipe(gulp.dest('.'));
});

gulp.task('html', function() {
  gulp.src('./src/index.html')
    .pipe(htmlMin({ collapseWhitespace: true }))
    .pipe(gulp.dest('.'));
});

gulp.task('default', ['css', 'html']);
