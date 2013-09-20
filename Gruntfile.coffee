module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')

    connect:
      server:
        options:
          hostname: '*'
          livereload: true
    sass:
      default:
        options:
          style: 'compressed'
        files: [
          expand: true
          cwd: 'src/'
          src: ['css/*.scss']
          ext: '.css'
        ]
    jade:
      default:
        expand: true
        cwd: 'src/'
        src: ['*.jade']
        ext: '.html'
    coffee:
      default:
        files: [
          expand: true
          cwd: 'src/'
          src: ['js/*.coffee']
          dest: 'src/'
          ext: '.js'
        ]
    uglify:
      default:
        files: [
          expand: true
          cwd: 'src/'
          src: ['js/*.js']
        ]
    imagemin:
      default:
        files: [
          expand: true
          cwd: 'src/'
          src: ['img/*.{jpg,jpeg,png,gif}']
        ]
    watch:
      options:
        livereload: true
      css:
        files: 'src/css/*.scss'
        tasks: ['sass']
      jade:
        files: 'src/*.jade'
        tasks: ['jade']
      js:
        files: 'src/js/*.coffee'
        tasks: ['coffee', 'uglify']
      img:
        files: 'src/img/*.{jpg, jpeg, png}'
        tasks: ['imagemin']

  grunt.loadNpmTasks('grunt-contrib-connect')
  grunt.loadNpmTasks('grunt-contrib-sass')
  grunt.loadNpmTasks('grunt-contrib-jade')
  grunt.loadNpmTasks('grunt-contrib-imagemin')
  grunt.loadNpmTasks('grunt-contrib-coffee')
  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-watch')

  grunt.registerTask('default', ['connect', 'coffee', 'uglify', 'jade', 'imagemin', 'sass', 'watch'])

