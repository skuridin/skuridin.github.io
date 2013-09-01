module.exports = (grunt) ->
  grunt.initConfig(
    pkg: grunt.file.readJSON('package.json')
    sass:
      dist:
        options:
          style: 'compressed'
        files: [
          expand: true,
          cwd: 'css',
          src: ['*.scss'],
          dest: 'css',
          ext: '.min.css'
        ]
    htmlmin:
      dist:
        options:
          removeComments: true
          collapseWhitespace: true
          collapseBooleanAttributes: true
          removeEmptyAttributes: true
        files:
          'index.html': 'index.src.html'
    connect:
      test:
        options:
          hostname: '*'
          port: 8000
          base: '.'
          middleware: (connect, options) ->
            return [
              require('connect-livereload')(),
              connect.static(options.base)
            ];
    watch:
      css:
        files: 'css/*.scss',
        tasks: ['sass']
      html:
        files: 'index.src.html'
        tasks: ['htmlmin']
      options:
        livereload: true
  )

  grunt.loadNpmTasks('grunt-contrib-sass')
  grunt.loadNpmTasks('grunt-contrib-connect')
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-contrib-htmlmin')

  grunt.registerTask('default', ['connect', 'watch'])

