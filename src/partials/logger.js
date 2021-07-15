/**
   * Outputs a logging message to help reveal the communication process.
   * NOTE: Debugging should only be available in talkin-debug.js and talkin-demo.js.
   *
   * @param  {String} message   The logging message to output.
   */
  function l(message) {
    if (typeof win.console !== 'undefined') {
      win.console.log('### ' + message);
    }
    else {
      win.alert(message);
    }
  }