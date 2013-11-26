(function(win) {

  var TalkIn = win.LI.TalkIn,
      body = document.getElementsByTagName('body')[0],
      loc = win.location,
      origin = loc.protocol + '//' + loc.host,
      sendMethodsToTest = 10,

      // Endpoints for 'register' tests.
      test1 = (function() {
        return {
          method1: function(data) {
            return true;
          },
          method2: function(data) {
            return true;
          }
        };
      }()),

      test2 = (function() {
        var TEST = 'test';
        return {
          method3: function(data) {
            return TEST;
          }
        }
      }()),

      // Endpoint for 'send' tests.
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
          legacy: function(data) {
            ok(true, 'Data delivered using legacy fallback.');
            done();
          },

          multicall1: function(data) {
            ok(true, 'Multiple calls, 1 of 3');
            done();
          },
          multicall2: function(data) {
            ok(true, 'Multiple calls, 2 of 3');
            done();
          },
          multicall3: function(data) {
            ok(true, 'Multiple calls, 3 of 3');
            done();
          },

          bulkcall1: function(data) {
            ok(true, 'Bulk call, 1 of 2');
            done();
          },
          bulkcall2: function(data) {
            ok(true, 'Bulk call, 2 of 2');
            done();
          },

          legacyBulkcall1: function(data) {
            ok(true, 'Legacy bulk call, 1 of 2');
            done();
          },
          legacyBulkcall2: function(data) {
            ok(true, 'Legacy bulk call, 2 of 2');
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
    var endpoints = TalkIn.endpoints;
    TalkIn.register('testMethod1', testMethod);
    TalkIn.register('testMethod2', 3);
    TalkIn.register('testRegister', test1);
    TalkIn.register('testRegister', test2);
    equal(typeof endpoints.testMethod1, 'function', 'Functions are exposed in the \'endpoints\' object.');
    equal(typeof endpoints.testMethod2, 'undefined', 'Only objects can be registered.');
    equal(typeof endpoints.testRegister.method1, 'function', 'Registering two objects using the same namespace will combine them.');
    equal(endpoints.testRegister.method3(), 'test', 'Combined endpoints can still access private data.');
  });

  asyncTest('Sending data.', sendMethodsToTest, function() {
    var flippedOrigin = flipOrigin(origin);
    TalkIn.register('methods', methods);
    buildIFrame(origin + '/test/html/frame-same.html');
    buildIFrame(flippedOrigin + '/test/html/frame-different.html');
    buildIFrame(origin + '/test/html/frame-legacy-different.html');
    buildIFrame(flippedOrigin + '/test/html/frame-different-multiple.html');
    buildIFrame(flippedOrigin + '/test/html/frame-different-sendbulk.html');
    buildIFrame(origin + '/test/html/frame-legacy-sendbulk.html');
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