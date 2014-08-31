var gulp        = require('gulp'),
    sass        = require('gulp-sass'),
    changed     = require('gulp-changed'),
    connect     = require('gulp-connect');

gulp.task('html', function() {
    gulp.src('src/*.html')
        .pipe(changed('.'))
        .pipe(gulp.dest('.'))
        .pipe(connect.reload());
});

gulp.task('images', function() {
    gulp.src(['src/img/*.png', 'src/img/*.jpg'])
        .pipe(changed('.'))
        .pipe(gulp.dest('./img'))
        .pipe(connect.reload());
});

gulp.task('styles', function() {
    gulp.src('./src/css/*.scss')
        .pipe(changed('./css'))
        .pipe(sass())
        .pipe(gulp.dest('./css'))
        .pipe(connect.reload());
});

gulp.task('connect', function() {
    connect.server({
        livereload: true,
        port: 8000
    });
});

gulp.task('watch', function() {
    gulp.watch('src/css/*.scss', ['styles']);
    gulp.watch('src/*.html', ['html']);
});

gulp.task('default', ['connect', 'watch', 'html', 'styles']);
