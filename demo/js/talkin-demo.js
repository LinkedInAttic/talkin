/*
TalkIn
v1.3.0
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

if (!window.LI) {
  window.LI = {};
}
LI.TalkIn = LI.Talkin || (function(win) {
  'use strict';

  // Handshake message data for postMessage mode.
  var READY_MESSAGE = '__READY__',

    // Backwards-compatible ready message required for transition.
    // *** REMOVE in 1.3.1.
    LEGACY_READY_MESSAGE = 'ADTALK_READY',

    // Temporary property for postMessage data objects containing the target endpoint.
    ENDPOINT_PROPERTY = 'ADTALK_ENDPOINT',

    // The postMessage 'message' event.
    MESSAGE_EVENT = 'message',

    // Cached reference to the Object type.
    TYPE_OBJECT = '[object Object]',

    // A cached reference to the document object.
    doc = win.document,

    // A cached reference to window.top.
    windowTop = win.top,

    // Checks if the top window is running the script.
    // We need to 'window.window' to work in IE8.
    isTopWindow = win.window === windowTop,

    // Checks if a WebKit browser is running the script.
    // Feature detection does the trick.
    isWebKit = win.webkitURL !== undefined,

    // Is this browser good and modern?
    hasPostMessage = win.postMessage !== undefined,

    // Cached reference to the object prototype's toString method.
    toStringProto = Object.prototype.toString,

    // If the browser does not pass same-origin security and doesn't support postMessage,
    // we'll fall back to iframe support. This boolean lets TalkIn know the support harness is ready.
    isLegacyReady = false,

    // If the child initializes first and immediately sends a message (on page load perhaps), the parent
    // may not be ready to receive it. The message will be resent this number of times per 100ms to
    // allow the parent to finish loading.
    handshakeTimeout = 20,

    // A reference to the handshaking setInterval.
    handshakeInterval,

    // Object namespace containing a collection of methods that can be executed via TalkIn.
    endpointNamespace,

    // The origin of the opposite TalkIn node.
    remoteOrigin,

    // If we're using postMessage and the handshake fails, TalkIn.send will
    // attempt to shake hands again. The data send with the initial call will be
    // reused when the handshake is successful.
    cachedData = [],

    // Methods to bind listeners to objects. (el, evt, fn)
    addListener,
    removeListener;

  /**
   * Outputs a logging message to help reveal the communication process.
   * NOTE: Debugging should only be available in talkin-debug.js and talkin-demo.js.
   *
   * @param  {String} message   The logging message to output.
   */

  function l(message) {
    if (typeof win.console !== 'undefined') {
      win.console.log('### ' + message);
    } else {
      win.alert(message);
    }
  }

  /**
   * Removes the document's subdomains in an attempt to match origins.
   *
   * @return {Boolean} Returns true if the domain was stripped.
   */

  function stripSubdomain() {
    var newDomain = doc.domain.split('.').slice(-2).join('.');
    if (doc.domain !== newDomain) {
      doc.domain = newDomain;
      return true;
    }
    return false;
  }

  /**
   * Sets methods to add and remove events based on browser capabilities.
   *
   */

  function configureListenerMethods() {

    // Standard support.
    if (win.addEventListener) {
      addListener = function(el, evt, fn) {
        el.addEventListener(evt, fn, false);
      };
      removeListener = function(el, evt, fn) {
        el.removeEventListener(evt, fn);
      };
    }

    // Old IE support.
    else if (win.attachEvent) {
      addListener = function(el, evt, fn) {
        el.attachEvent('on' + evt, fn);
      };
      removeListener = function(el, evt, fn) {
        el.detachEvent('on' + evt, fn);
      };
    }
  }

  /**
   * Determines if the passed argument is an object or not.
   *
   * @param  {...}  obj   A value to test.
   *
   * @return {Boolean}    Is the argument an object?
   */

  function isObject(obj) {
    return toStringProto.call(obj) === TYPE_OBJECT;
  }

  /**
   * Invokes the endpoint, checking to see if the enpoint is namespaced or not.
   * (For instance, the endpoint 'foo.bar' will execute 'bar' on the 'foo' object
   * in TalkIn's 'endpoints' namespace.)
   *
   * @param  {String || Object} endpointOrData  The endpoint you wish to invoke, by string.
   *                                            Can be namespaced with a period (E.G. 'foo' or 'foo.bar').
   *                                            Or, an object containing endpoints and the
   *                                            data you wish to deliver.
   * @param  {Object} data                      The data object you wish to pass to the endpoint.
   *                                            Not required if the first argument is a data object.
   */

  function invokeEndpoint(endpointOrData, data) {

    var endpoint, node, base;

    // If the first argument is an object, loop through the base objects (which should be endpoints).
    // Invoke this function again using the key as a method and value as data.
    if (isObject(endpointOrData)) {
      for (endpoint in endpointOrData) {
        invokeEndpoint(endpoint, endpointOrData[endpoint]);
      }
    }

    // Else, process the endpoint and data normally.
    else {
      endpoint = endpointOrData.split('.'),
      node = endpoint[0],
      base = endpointNamespace.hasOwnProperty(node) ? endpointNamespace[node] : null;

      if (endpoint.length > 1) {
        node = endpoint[1];
        if (base.hasOwnProperty(node)) {
          base[node](data);
        }
      } else {
        base(data);
      }
    }
  }

  /**
   * The sister function to sendLegacyMessage, invoked if legacy support has not been configured.
   *
   * If the user's browser does not have postMessage, we'll fallback to an origin-matching
   * method involving opening multiple iframes---one for each potential origin the parent
   * could be. This function creates the necessary iframes and loads the JSON lib.
   *
   * @param  {Object} data              Since this function is lazily instantiated (only when TalkIn.send
   *                                    is invoked), we want to defer sending the data until support is complete.
   * @param  {Number} numberOfOrigins   How many potential origins are there?
   */

  function configureLegacySupport(data, numberOfOrigins) {

    var scriptId = 'TALKIN_JSON_LIBRARY',
      containerId = 'TALKIN_LEGACY_CONTAINER',
      hasJSON = (typeof JSON !== 'undefined'),
      head,
      script,
      body,
      container,
      iframe,
      iframeStyle;

    l('Begin configuring legacy support...');

    // Begin loading JSON library unless the dynamic script element already exists.
    if (!doc.getElementById(scriptId) && !hasJSON) {

      l('Creating a script element to load JSON lib.');

      head = doc.getElementsByTagName('head')[0];
      if (head) {
        script = doc.createElement('script');
        script.id = scriptId;
        script.src = '/js/json2.js';
        script.type = 'text/javascript';
        head.appendChild(script);
      }
    }

    // Create a container and place all our iframes in it.
    if (!doc.getElementById(containerId)) {

      l('Creating iframe container.');

      container = doc.createElement('div');
      container.id = containerId;

      while (numberOfOrigins--) {

        l('Creating iframe...');

        iframe = doc.createElement('iframe');
        iframeStyle = iframe.style;
        iframeStyle.visibility = 'hidden';
        iframeStyle.width = '1px';
        iframeStyle.height = '1px';
        iframeStyle.position = 'absolute';
        iframeStyle.left = '-999px';
        iframeStyle.top = '0';
        container.appendChild(iframe);
      }

      body = doc.getElementsByTagName('body')[0];
      if (body) {
        body.appendChild(container);
      }
    }

    // If JSON doesn't exist yet (async call), try checking again in 100.
    if (!hasJSON) {
      win.setTimeout(function() {
        configureLegacySupport(data);
      }, 100);
      return;
    }

    // We're all good! Continue with the message call.
    else {
      isLegacyReady = true;
      sendLegacyMessage(data);
    }

  }

  /**
   * The brother function to configureLegacySupport. We actually send the message here.
   *
   * If the user's browser does not have postMessage, we'll fallback to an origin-matching
   * method involving opening multiple iframes---one for each potential origin the parent
   * could be. This function loops through the iframes, setting the origins.
   *
   * @param  {Object} data              Since this function is lazily instantiated (only when TalkIn.send
   *                                    is invoked), we want to defer sending the data until support is complete.
   */

  function sendLegacyMessage(data) {

    var possibleParentOrigins = [
      'https://localhost:9443', 'http://localhost:9090'
    ],
      path = '/src/lib/talkin/demo/html/sender.html?',
      len = possibleParentOrigins.length,
      container,
      iframes;

    /**
     * A little security function to validate URLs:
     * If the URL starts from http://, https://, //, /, ?, #, . it returns the URL.
     * Else, it throws an exception.
     *
     * @param  {String} url The URL to validate.
     *
     * @return {String}     The validated URL.
     */

    function validateURL(url) {
      if (!url.match(/^(?:https?:\/\/|[\/?#.])/i)) {
        throw new Error('URL is not valid: ' + url);
      } else {
        return url;
      }
    }

    if (!isLegacyReady) {
      l('Legacy support is not ready!');
      configureLegacySupport(data, len);
      return;
    }

    container = doc.getElementById('TALKIN_LEGACY_CONTAINER');
    if (container) {
      iframes = container.getElementsByTagName('iframe');
    }

    if (iframes) {
      l('Begin setting iframe srcs.');
      data = '#' + encodeURIComponent(JSON.stringify(data));
      while (len--) {
        // We need to cache bust the source to refresh the iframe.
        iframes[len].src = validateURL(possibleParentOrigins[len] + path + Math.random().toString().slice(2) + data);
      }
    }
  }

  /**
   * Invoked when a postMessage event is captured. This is used when setting up the communication
   * handshake and actually invoking the endpoints with data.
   *
   * @param  {Object} evt   The postMessage event object.
   */

  function processMessage(evt) {

    var data = evt.data,
      parsedData,
      endpoint,
      cached;

    // If this is the parent...
    if (isTopWindow) {

      l('Message received in parent...');

      // *** UPDATE in 1.3.1.
      if (data === READY_MESSAGE || data === LEGACY_READY_MESSAGE) {
        l('READY! From origin: ' + evt.origin + '. Posting back to child...');
        endpointNamespace = LI.TalkIn.endpoints;
        evt.source.postMessage(READY_MESSAGE, evt.origin);
      } else {

        try {
          parsedData = JSON.parse(data);
          endpoint = parsedData[ENDPOINT_PROPERTY] || parsedData;

          l('remoteOrigin is set! Process the endpoint: ' + endpoint + '');

          delete parsedData[ENDPOINT_PROPERTY];
          invokeEndpoint(endpoint, parsedData);
        } catch (err) {
          l('ERROR! Parent could not parse message: ' + evt.data + '');
        }

      }

    }

    // If this is the child...
    else {

      l('Message received in child...');

      // *** UPDATE in 1.3.1.
      if (!remoteOrigin && (data === READY_MESSAGE || data === LEGACY_READY_MESSAGE)) {
        remoteOrigin = evt.origin;
        removeListener(win, MESSAGE_EVENT, processMessage);

        l('remoteOrigin set to: ' + remoteOrigin + '. Removing listener.');

        // If the ready message was received as a result of rapid handshake attempts,
        // end and clear the interval.
        if (handshakeInterval) {
          win.clearInterval(handshakeInterval);
          handshakeInterval = null;
        }

        // If there is cachedData, that means TalkIn.send initially failed the handshake.
        // Now that it was successful, attempt to send the initial data again.
        while (cachedData.length) {
          l('There was cachedData available. Send it to parent.');
          cached = cachedData.pop();
          if (cached[ENDPOINT_PROPERTY]) {
            LI.TalkIn.send(cached[ENDPOINT_PROPERTY], cached);
          } else {
            LI.TalkIn.send(cached);
          }
        }
      }

    }

  }

  // Initialize

  l('TalkIn init: ' + win.location + '');

  // Set event listener attach/detatch methods.
  configureListenerMethods();

  // Configure the parent to listen for potential postMessage messages.
  if (isTopWindow) {
    l('Initializing parent, setting message listener.');
    if (hasPostMessage) {
      addListener(win, MESSAGE_EVENT, processMessage);
    }
  }

  // If this isn't the top window then it's probably the iframe that wishes to communicate.
  // Let's try a few methods to establish a connection.
  else {

    l('Initializing child...');

    // If Webkit, don't try to access the parent's object at all; Webkit won't catch security errors.
    if (!isWebKit) {

      l('Not Webkit...');

      // Try accessing the 'endpoints' namespace.
      try {
        l('Attempting to set namespace...');
        endpointNamespace = windowTop.LI.TalkIn.endpoints;
      } catch (err) {

        // If that fails, try stripping subdomains in an attempt to match and try again.
        try {
          l('FAIL. Try stripping subdomain and setting again...');
          if (stripSubdomain()) {
            endpointNamespace = windowTop.LI.TalkIn.endpoints;
          }
        }

        // If it still fails, give up accessing the parent directly.
        catch (lastErr) {
          l('FAIL. Give up and do postMessage.');
        }
      }
    }

    // If the namespace couldn't be set and this is a modern browser, resort to postMessage.
    if (hasPostMessage && !endpointNamespace) {
      //Set a listener to establish a postMessage handshake for security purposes.
      l('No endpoint set. Resort to postMessage. Listening for handshake.');
      addListener(win, MESSAGE_EVENT, processMessage);
    }

  }

  return {

    // Available endpoints that can be accessed by TalkIn.
    endpoints: {},

    /**
     * Register an endpoint to be accessed by the child. The endpoint can either be
     * a function or an object that exposes functions---the latter being useful for
     * organizing a collection of similar methods.
     *
     * @param  {String}               name       The name of the endpoint to access.
     * @param  {Function || Object}   endpoint   The function to invoke or an object
     *                                           that exposes functions to invoke.
     */
    register: function(name, endpoint) {

      var endpoints = this.endpoints,
        endpointObject,
        p;

      if (name && endpoint && endpoint instanceof Object) {
        if (endpoints[name] && isObject(endpoint)) {
          endpointObject = endpoints[name];
          for (p in endpoint) {
            endpointObject[p] = endpoint[p];
          }
        } else {
          endpoints[name] = endpoint;
        }
      }
    },

    /**
     * Transports a data object from the child to the desired endpoint in the parent.
     *
     * @param {String || Object} endpointOrData   The registered endpoint you wish to invoke OR
     *                                            an object containing endpoints and the data you
     *                                            wish to deliver to each.
     * @param {Object} data                       An object containing the JSON you wish to deliver.
     *                                            Not required if the first argument is a data object.
     *
     * Invocation examples:
     *
     * send('myEndpoint', {
     *   number: 3,
     *   string: 'Hello'
     * });
     *
     * send({
     *   myEndpoint: {
     *     number: 3,
     *     string: 'Hello'
     *   }
     * });
     */
    send: function(endpointOrData, data) {

      // You can't send from the top-most parent.
      if (isTopWindow) {
        return;
      }

      l('TalkIn send fired from ' + win.location + '');

      // If the endpointNamespace is set, the parent and child are on indentical origins.
      // Just call the parent's method directly.
      if (endpointNamespace && endpointOrData) {
        l('...and since an endpoint was successfully set, use it.');
        invokeEndpoint(endpointOrData, data);
      }

      // Otherwise we'll use postMessage ... or the legacy fallback.
      else {

        // Append the endpointOrData to the data object so the other methods know what to call.
        if (data) {
          data[ENDPOINT_PROPERTY] = endpointOrData;
        } else {
          data = endpointOrData;
        }

        // If this is a modern browser, then sweet! Use postMessage.
        if (hasPostMessage) {
          l('...using postMessage to invoke.');

          // If the remoteOrigin is set, that means the parent and child successfully shook hands.
          if (remoteOrigin) {
            windowTop.postMessage(JSON.stringify(data), remoteOrigin);
          }

          // Otherwise, try establishing the handshake again. The child probably loaded before the parent.
          // Cache the data so it can be sent when the connection is established.
          else {
            cachedData.push(data);

            if (!handshakeInterval) {

              l('...but remoteOrigin was not set!');

              handshakeInterval = win.setInterval(function() {

                l('...attempting handshake... ' + handshakeTimeout + '');

                windowTop.postMessage(READY_MESSAGE, '*');

                if (!(handshakeTimeout--)) {
                  l('Handshake failed.');
                  win.clearInterval(handshakeInterval);
                }
              }, 100);
            }
          }
        }

        // Otherwise, this is probably an old version of IE. Time to get nuts.
        else {
          l('...falling back to ancient browser support.');
          sendLegacyMessage(data);
        }
      }

    },

    /**
     * A helper function to grab the window's query string and convert it into a friendly object.
     * This also extracts the weird DoubleClick params, which are semicolon-separated key-value
     * pairs that appear before the location search.
     *
     * @return {Object} The window's query string in key-value format.
     */
    getQueryParams: function() {

      var loc = win.location,
        pairs = loc.search.slice(1).split('&').concat(loc.pathname.match(/\w+=\w+/g)),
        params = {},
        param,
        pair;

      function xssSanitize(text) {
        return text.replace(/[\x00'"<\\]/g, '\uFFFD');
      }

      while (pairs.length) {
        pair = pairs.pop();
        if (pair) {
          param = pair.split('=');
          if (param.length > 1) {
            params[param[0]] = xssSanitize(param[1]);
          }
        }
      }

      return params;
    },

    addListener: addListener,
    removeListener: removeListener,

    VERSION: '1.3.0'

  };

}(window));
