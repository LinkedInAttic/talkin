(function(win) {

  var TalkIn = win.LI.TalkIn,
      body = document.getElementsByTagName('body')[0],
      loc = win.location,
      origin = loc.protocol + '//' + loc.host,
      sendMethodsToTest = 3,

  methods = (function() {

    var semaphore = sendMethodsToTest;

    function done() {
      if (!--semaphore) {
        start();
      }
    }

    return {

      sameOrigin: function(data) {
        ok(true, 'Data delivered using direct access on same origin.');
        done();
      },
      differentOrigin: function(data) {
        ok(true, 'Data delivered using postMessage on different origin.');
        done();
      },
      legacyDifferentOrigin: function(data) {
        ok(true, 'Data delivered using legacy fallback on different origin.');
        done();
      }

    };
  }());

  function testMethod(data) {}

  function buildIFrame(src) {
    var iframe = document.createElement('iframe');
    iframe.src = src;
    body.appendChild(iframe);
  }

  function flipOrigin(origin) {

    var HTTP_PORT = ':9090',
        HTTPS_PORT = ':9443',
        HTTP = 'http:',
        HTTPS = 'https:';

    if (origin.indexOf(HTTP) !== -1) {
      return origin.replace(HTTP, HTTPS).replace(HTTP_PORT, HTTPS_PORT);
    }
    else {
      return origin.replace(HTTPS, HTTP).replace(HTTPS_PORT, HTTP_PORT);
    }

    return origin;
  }

  test('Parent has an \'endpoints\' object exposed.', function() {
    equal(typeof TalkIn.endpoints, 'object');
  });

  test('Parent has a \'register\' method exposed.', function() {
    equal(typeof TalkIn.register, 'function');
  });

  test('Registering functions.', function() {
    TalkIn.register('testMethod1', testMethod);
    TalkIn.register('testMethod2', 3);
    equal(typeof TalkIn.endpoints.testMethod1, 'function', 'Functions are exposed in the \'endpoints\' object.');
    equal(typeof TalkIn.endpoints.testMethod2, 'undefined', 'Only objects can be registered.');
  });

  asyncTest('Sending data.', sendMethodsToTest, function() {
    var flippedOrigin = flipOrigin(origin);
    TalkIn.register('methods', methods);
    buildIFrame(origin + '/test/html/frame-same.html');
    buildIFrame(flippedOrigin + '/test/html/frame-different.html');
    buildIFrame(flippedOrigin + '/test/html/frame-legacy-different.html');
  });

  asyncTest('Fetching query params.', function() {
    TalkIn.register('processQueryParams', function(data) {
      ok(data.params.baz === 'socks', 'Params are fetched properly.');
      start();
    });
    buildIFrame(origin + '/test/html/frame-query-params.html?foo=true&bar=42&baz=socks');
  });

  asyncTest('Testing event listeners.', function() {
    TalkIn.addListener(window, 'message', function(evt) {
      ok(true, 'TalkIn.addListener attaches events.');
      start();
    });
    window.postMessage('test', '*');
  });

}(window));