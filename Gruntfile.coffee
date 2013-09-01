module.exports = (grunt) ->
  grunt.initConfig(
    pkg: grunt.file.readJSON('package.json')
    sass:
      dist:
        options:
          style: 'compressed'
        files: [
          expand: true
          cwd: 'src/'
          src: ['css/*.scss']
          ext: '.css'
        ]
    htmlmin:
      dist:
        options:
          removeComments: true
          collapseWhitespace: true
          collapseBooleanAttributes: true
          removeEmptyAttributes: true
        files:
          'index.html': 'src/index.html'
    imagemin:
      dist:
        files: [
          expand: true
          cwd: 'src/'
          src: ['img/*.{jpg, jpeg, png}']
        ]
    connect:
      test:
        options:
          hostname: '*'
          port: 8000
          base: '.'
          middleware: (connect, options) ->
            return [
              require('connect-livereload')()
              connect.static(options.base)
            ];
    watch:
      css:
        files: 'src/css/*.scss'
        tasks: ['sass']
      html:
        files: 'src/index.html'
        tasks: ['htmlmin']
      options:
        livereload: true
  )

  grunt.loadNpmTasks('grunt-contrib-sass')
  grunt.loadNpmTasks('grunt-contrib-connect')
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-contrib-htmlmin')
  grunt.loadNpmTasks('grunt-contrib-imagemin')

  grunt.registerTask('default', ['imagemin', 'connect', 'watch'])

