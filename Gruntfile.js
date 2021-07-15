/*
TalkIn
(c) 2013 LinkedIn Corp.  All rights reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an "AS
IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either
express or implied. See the License for the specific language
governing permissions and limitations under the License.
*/

/**
 * Gruntfile for configuring, building, and demoing TalkIn.
 */
module.exports = function(grunt) {

  // Location of the main TalkIn template file.
  var TEMPLATE        = 'src/talkin-template.js',

      // Directory where template code snippets reside.
      PARTIALS        = 'src/partials/',

      // Cached reference to Grunt's file object.
      GRUNT_FILE      = grunt.file,

      // Cached reference to Grunt's template processing function.
      GRUNT_PROCESS   = grunt.template.process,

      // TalkIn's package.json file.
      PKG             = GRUNT_FILE.readJSON('package.json'),

      // A file used for building different versions of TalkIn. Contains mappings
      // for debug messages and partials.
      BUILD_JSON      = GRUNT_FILE.readJSON('config/build.json'),

      // The SHA1 hashing function used for whitelisted origins.
      hash            = require("./src/partials/sha1-grunt").hash,

      // User configuration of whitelist origins and legacy support mappings.
      config          = getConfig(),

      // An array of configuration flags as strings used for building different versions of TalkIn.
      configFlags     = getFlags();

  /**
   * Crates an array of configuration flags (first-level keys from build.json).
   *
   * @return {Array} A collection of flags as strings.
   */
  function getFlags() {

    var flags = [], f;
    for (f in BUILD_JSON) {
      flags.push(f);
    }
    return flags;
  }

  /**
   * Reads in the user configuration file and properly formats the
   * whitelist origins into quoted strings.
   *
   * @return {Object} JSON containing the user configuration.
   */
  function getConfig() {

    var configFile = GRUNT_FILE.readYAML('config/config.yaml');

    /**
     * Formats a collection of strings to be written into partials
     * and optionally transforms them based on a function.
     *
     * @param  {Array}    collection  An array of strings to format.
     * @param  {Function} convert     An optional function to further format the strings.
     *
     * @return {Array}                The formatted collection.
     */
    function format(collection, convert) {

      var len = collection.length,
          formattedCollection = [];

      while (len--) {
        formattedCollection.push('\'' + (convert ? convert(collection[len]) : collection[len]) + '\'');
      }
      
      return formattedCollection;
    }

    configFile.whitelist = format(configFile.whitelist, hash);
    configFile.legacy.whitelist = format(configFile.legacy.whitelist);
    configFile.demoLegacy.whitelist = format(configFile.demoLegacy.whitelist);
    return configFile;
  }

  /**
   * Creates an object for concat task options containing one key: process.
   * Note that you can technically use an object for the process option value but
   * this implementation will die unless you use a function.
   *
   * @param  {Object} flags  A map of flags used for configuring a file.
   *
   * @return {Object}        A config object for the concat task.
   */
  function getOptions(flags) {
    return {
      process: function(src) {
        return GRUNT_PROCESS(src, processData(flags));
      }
    };
  }

  /**
   * Creates a config object based on the configuration flags passed.
   *
   * @param  {Object} flags  The flags used to configure the file.
   *                         Example: {debug: true, secure: true}
   *
   * @return {Object}        An object formatted for use in grunt.template.process,
   *                         containing the built config object.
   */
  function processData(flags) {

    var DEBUG = 'debug',
        data = {},
        len = configFlags.length,
        dataPointer,
        basePointer,
        hasFlag,
        isDebug,
        flag,
        p;

    // Let's loop through each defined config flag.
    while (len--) {
      flag = configFlags[len];

      // Create a new subobject in the config and point to it.
      dataPointer = data[flag] = {};

      // Change the base pointer to the object in 'flag'.
      basePointer = BUILD_JSON[flag];

      // Was this flag set for this data object?
      hasFlag = flags[flag];

      // Is this the 'debug' flag?
      isDebug = flag === DEBUG;

      // For each key in the base config...
      for (p in basePointer) {

        // If this flag was set, populate the dataPointer object with the appropriate data.
        if (hasFlag) {
          if (isDebug) {
            dataPointer[p] = 'l(\'' + basePointer[p] + '\');';
          }
          else {
            dataPointer[p] = GRUNT_FILE.read(PARTIALS + basePointer[p]);
          }
        }

        // Otherwise, blank out the related data.
        else {
          dataPointer[p] = '';
        }
      }
    }

    // Append package and user config data to the object before returning it.
    data.pkg = PKG;
    data.config = config;

    // If this is the demo, update legacy support config to work in the demo environment.
    if (flags.demo) {
      data.config.legacy = config.demoLegacy;
    }

    return {data: data};
  }

  // Grunt's initConfig: Run all our tasks.
  grunt.initConfig({

    // Our package.json file.
    pkg: PKG,

    // Build all the versions:
    concat: {

      // Intended for use on the parent (top) document. Doesn't include any send support
      // as that is handled by the child.
      parent: {
        options: getOptions({parent: true, secure: true}),
        files: {'dist/talkin-parent.js': [TEMPLATE]}
      },

      // Intended for use in the child (iframed) document. Doesn't include endpoint registration
      // as that is handled by the parent.
      child: {
        options: getOptions({child: true, secure: true}),
        files: {'dist/talkin-child.js': [TEMPLATE]}
      },

      // Includes debug messages and the entire implementation (parent and child).
      debug: {
        options: getOptions({debug: true, logger: true, child: true, parent: true, secure: true}),
        files: {'dist/talkin-debug.js': [TEMPLATE]}
      },

      // This is the debug version minus whitelist checking. Useful for quick demos where
      // origin safetly doesn't matter.
      demo: {
        options: getOptions({debug: true, logger: true, child: true, parent: true, demo: true}),
        files: {'dist/talkin-demo.js': [TEMPLATE]}
      }

    },

    // Hint all our dist files and this Gruntfile.
    jshint: {
      all: {
        files: {
          src: [
            'dist/*.js',
            'Gruntfile.js'
          ]
        },
        jshintrc: '.jshintrc'
      }
    },

    // Minify the parent and child files for production.
    uglify: {
      parent: {
        options: {
          banner: '/*! <%= pkg.name %> <%= pkg.version %> */\n'
        },
        src: 'dist/talkin-parent.js',
        dest: 'dist/min/talkin-parent.min.js'
      },
      child: {
        options: {
          banner: '/*! <%= pkg.name %> <%= pkg.version %> */\n'
        },
        src: 'dist/talkin-child.js',
        dest: 'dist/min/talkin-child.min.js'
      }
    },

    // Blanking out unneeded template includes in the build process leaves behind
    // lots of whitespace. Let's change that.
    jsbeautifier: {
      files: [
        'dist/talkin-debug.js',
        'dist/talkin-parent.js',
        'dist/talkin-child.js',
        'dist/talkin-demo.js'
      ],
      options: {
        indent_size: 2,
        max_preserve_newlines: 2
      }
    },

    // Miscellaneous shell commands.
    shell: {

      // Fire up the demo server.
      server: {
        command: 'cd server/ && node server.js',
        options: {
            stdout: true
        }
      },

      // Copy all dist files to the demo js directory.
      copy: {
        command: 'cp dist/talkin-demo.js demo/js/'
      }
    },

    clean: ['dist/*']

  });

  /**
   * Whitelist origins are hashed in two places: In the build process from a config file,
   * and during TalkIn's execution for origin matching. We want to use the exact same method
   * in both places but each one must be formatted slightly differently. This task takes the
   * modular sha1 file and prepares it for use as a partial in the build system.
   */
  grunt.registerTask('createSha1File', function() {
    var file = GRUNT_FILE.read('src/partials/sha1-grunt.js').replace('exports.', '').replace(/;$/, ',');
    GRUNT_FILE.write('src/partials/sha1.js', file);
  });

  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-jsbeautifier');
  grunt.loadNpmTasks('grunt-shell');

  grunt.registerTask('build', ['default']);
  grunt.registerTask('server', ['shell:server']);
  grunt.registerTask('default', [
    'clean',
    'createSha1File',
    'concat',
    'jsbeautifier',
    'jshint',
    'uglify',
    'shell:copy'
  ]);
};