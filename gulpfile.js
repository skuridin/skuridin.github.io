var gulp = require('gulp'),
    _p   = require('gulp-load-plugins')();

_p.del = require('del');
_p.fs  = require('fs');

var SRC  = './src',
    DIST = '.';

gulp.task('html', function() {
  gulp.src(SRC + '/*.jade')
      .pipe(_p.plumber())
      .pipe(_p.jade({ data: JSON.parse(_p.fs.readFileSync('./data.json')) }))
      .pipe(gulp.dest(DIST))
      .pipe(_p.connect.reload());
});

gulp.task('css', function() {
  gulp.src(SRC + '/css/main.styl')
      .pipe(_p.plumber())
      .pipe(_p.stylus())
      .pipe(_p.autoprefixer())
      .pipe(_p.minifyCss())
      .pipe(gulp.dest(DIST + '/css'))
      .pipe(_p.connect.reload());
})

gulp.task('js', function() {
  gulp.src(SRC + '/js/*.js')
      .pipe(_p.plumber())
      .pipe(_p.uglify())
      .pipe(gulp.dest(DIST + '/js'))
      .pipe(_p.connect.reload());
})

gulp.task('img', function() {
  gulp.src(SRC + '/img/**/*')
      .pipe(_p.plumber())
      .pipe(_p.imagemin({ progressive: true }))
      .pipe(gulp.dest(DIST + '/img'))
      .pipe(_p.connect.reload());
})

gulp.task('server', function() {
  _p.connect.server({ root: './.', livereload: true });
});

gulp.task('watch', function() {
  _p.watch(SRC + '/**/*.jade', function() { gulp.start('html'); });
  _p.watch(SRC + '/css/*.styl', function() { gulp.start('css'); });
  _p.watch(SRC + '/js/*.js', function() { gulp.start('js'); });
  _p.watch(SRC + '/img/**/*', function() { gulp.start('img'); });
  _p.watch('./data.json', function() { gulp.start('html') })
});

gulp.task('clean', function(cb) {
  _p.del([DIST + '/css', DIST + '/img'], cb)
})

gulp.task('build', ['clean'], function() {
  gulp.start(['html', 'css', 'js', 'img']);
});

gulp.task('default', ['build', 'server', 'watch']);
