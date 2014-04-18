module.exports = (grunt) ->
  grunt.initConfig
    pkg: grunt.file.readJSON('package.json')

    connect:
      server:
        options:
          hostname: '*'
          livereload: true
    concurrent:
      target1: ['jade', 'sass', 'coffee']
    sass:
      default:
        options:
          outputStyle: 'compressed'
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
        options:
          data: require('./params')
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
  grunt.loadNpmTasks('grunt-sass')
  grunt.loadNpmTasks('grunt-contrib-jade')
  grunt.loadNpmTasks('grunt-contrib-imagemin')
  grunt.loadNpmTasks('grunt-contrib-coffee')
  grunt.loadNpmTasks('grunt-contrib-uglify')
  grunt.loadNpmTasks('grunt-contrib-watch')
  grunt.loadNpmTasks('grunt-concurrent')

  grunt.registerTask('default', ['connect', 'concurrent:target1', 'uglify', 'watch'])

