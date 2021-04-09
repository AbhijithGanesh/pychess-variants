const gulp = require("gulp");
const browserify = require("browserify");
const source = require('vinyl-source-stream');
const tsify = require("tsify");
const watchify = require("watchify");
const gutil = require("gulp-util");
const buffer = require('vinyl-buffer');
const gulpBrotli = require('gulp-brotli');
const zlib = require('zlib');

const destination = './static';

function onError(error) {
  return gutil.log(gutil.colors.red(error.message));
};

function build(debug) {
  return browserify('client/main.ts', {
      standalone: 'PychessVariants',
      debug: debug
    })
    .plugin(tsify);
}

const watchedBrowserify = watchify(build(true));

function brotliOptions() {
  return {
    params: {
      [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
    },
  };
}

function bundle() {
  return watchedBrowserify
    .bundle()
    .on('error', onError)
    .pipe(source('pychess-variants.js'))
    .pipe(buffer())
    .pipe(gulp.dest(destination));
}

gulp.task("default", bundle);
watchedBrowserify.on("update", bundle);
watchedBrowserify.on("log", gutil.log);

gulp.task('dev', function() {
  return build(true)
    .bundle()
    .on('error', onError)
    .pipe(source('pychess-variants.js'))
    .pipe(gulp.dest(destination));
});

gulp.task('prod', function() {
  return build(false)
    .bundle()
    .on('error', onError)
    .pipe(source('pychess-variants.js'))
    .pipe(gulpBrotli(brotliOptions()))
    .pipe(gulp.dest(destination));
});
