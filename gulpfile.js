var gulp        = require('gulp'),
    sass        = require('gulp-sass'),
    changed     = require('gulp-changed'),
    htmlmin     = require('gulp-htmlmin'),
    cssshrink   = require('gulp-cssshrink'),
    connect     = require('gulp-connect');

gulp.task('html', function() {
    gulp.src('src/*.html')
        .pipe(changed('.'))
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(gulp.dest('.'))
        .pipe(connect.reload());
});

gulp.task('images', function() {
    gulp.src(['src/img/*.png', 'src/img/*.jpg', 'src/img/*.svg'])
        .pipe(changed('.'))
        .pipe(gulp.dest('./img'))
        .pipe(connect.reload());
});

gulp.task('styles', function() {
    gulp.src('./src/css/*.scss')
        .pipe(changed('./css'))
        .pipe(sass())
        .pipe(cssshrink())
        .pipe(gulp.dest('./css'))
        .pipe(connect.reload());
});

gulp.task('connect', function() {
    connect.server({
        livereload: true,
        port: 8000,
        host: "0.0.0.0"
    });
});

gulp.task('watch', function() {
    gulp.watch('src/css/*.scss', ['styles']);
    gulp.watch('src/*.html', ['html']);
});

gulp.task('default', ['connect', 'watch', 'html', 'styles', 'images']);
gulp.task('build', ['html', 'styles', 'images']);
