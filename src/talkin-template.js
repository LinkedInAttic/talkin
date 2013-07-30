/*
TalkIn
v<%= pkg.version %>
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

if (!window.LI) { window.LI = {}; }
LI.TalkIn = LI.Talkin || (function(win) {
  'use strict';

  // Handshake message data for postMessage mode.
  var READY_MESSAGE = 'TALKIN_READY',

    // Temporary property for postMessage data objects containing the target endpoint.
    ENDPOINT_PROPERTY = 'TALKIN_ENDPOINT',

    // The postMessage 'message' event.
    MESSAGE_EVENT = 'message',

    <%= secure.whitelist %>

    <%= secure.crypto %>

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
    cachedData,
    
    // Methods to bind listeners to objects. (el, evt, fn)
    addListener,
    removeListener;
  
  <%= logger.debugLogger %>

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
  
  <%= secure.isWhitelisted %>

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
   * Invokes the endpoint, checking to see if the enpoint is namespaced or not.
   * (For instance, the endpoint 'foo.bar' will execute 'bar' on the 'foo' object
   * in TalkIn's 'endpoints' namespace.)
   *
   * @param  {String} endpoint The endpoint you wish to invoke, by string. Can be namespaced
   *                           with a period (E.G. 'foo' or 'foo.bar').
   * @param  {Object} data     The data object you wish to pass to the endpoint.
   */
  function invokeEndpoint(endpoint, data) {
    var path = endpoint.split('.'),
        node = path[0],
        base = endpointNamespace.hasOwnProperty(node) ? endpointNamespace[node] : null;
    try {
      if (path.length > 1) {
        node = path[1];
        if (base.hasOwnProperty(node)) {
          base[node](data);
        }
      }
      else {
        base(data);
      }
    }
    catch (e) {
      <%= debug.endpointMissing %>
    }
  }

  <%= child.legacy %>

  /**
   * Invoked when a postMessage event is captured. This is used when setting up the communication
   * handshake and actually invoking the endpoints with data.
   *
   * @param  {Object} evt   The postMessage event object.
   */
  function processMessage(evt) {

    var data = evt.data,
        parsedData,
        endpoint;

    <%= secure.verifyWhitelist %>

    // If this is the parent...
    if (isTopWindow) {

      <%= debug.messageReceivedParent %>

      if (data === READY_MESSAGE) {
        <%= debug.settingRemoteOriginParent %>
        endpointNamespace = LI.TalkIn.endpoints;
        evt.source.postMessage(READY_MESSAGE, evt.origin);
      }

      else {

        try {
          parsedData = JSON.parse(data);
          endpoint = parsedData[ENDPOINT_PROPERTY];

          <%= debug.remoteOriginSet %>
          
          delete parsedData[ENDPOINT_PROPERTY];
          invokeEndpoint(endpoint, parsedData);
        }
        catch (err) {
          <%= debug.errorParsingMessage %>
        }

      }

    }

    // If this is the child...
    else {

      <%= debug.messageReceivedChild %>

      if (!remoteOrigin && data === READY_MESSAGE) {
        remoteOrigin = evt.origin;
        removeListener(win, MESSAGE_EVENT, processMessage);

        <%= debug.settingRemoteOriginChild %>

        // If the ready message was received as a result of rapid handshake attempts,
        // end and clear the interval.
        if (handshakeInterval) {
          win.clearInterval(handshakeInterval);
          handshakeInterval = null;
        }

        // If there is cachedData, that means TalkIn.send initially failed the handshake.
        // Now that it was successful, attempt to send the initial data again.
        if (cachedData) {
          <%= debug.cachedDataAvailable %>
          LI.TalkIn.send(cachedData[ENDPOINT_PROPERTY], cachedData);
          cachedData = null;
        }
      }

    }

  }

  // Initialize

  <%= debug.initStart %>

  // Set event listener attach/detatch methods.
  configureListenerMethods();

  // Configure the parent to listen for potential postMessage messages.
  if (isTopWindow) {
    <%= debug.initParent %>
    if (hasPostMessage) {
      addListener(win, MESSAGE_EVENT, processMessage);
    }
  }
  
  // If this isn't the top window then it's probably the iframe that wishes to communicate.
  // Let's try a few methods to establish a connection.
  else {
    
    <%= debug.initChild %>
    
    // If Webkit, don't try to access the parent's object at all; Webkit won't catch security errors.
    if (!isWebKit) {

      <%= debug.notWebkit %>
      
      // Try accessing the 'endpoints' namespace.
      try {
        <%= debug.settingNamespace %>
        endpointNamespace = windowTop.LI.TalkIn.endpoints;
      }
      
      catch (err) {
        
        // If that fails, try stripping subdomains in an attempt to match and try again.
        try {
          <%= debug.stripSubdomain %>
          if (stripSubdomain()) {
            endpointNamespace = windowTop.LI.TalkIn.endpoints;
          }
        }
        
        // If it still fails, give up accessing the parent directly.
        catch (lastErr) {
          <%= debug.giveUpSubdomain %>
        }
      }
    }

    // If the namespace couldn't be set and this is a modern browser, resort to postMessage.
    if (hasPostMessage && !endpointNamespace) {
      //Set a listener to establish a postMessage handshake for security purposes.
      <%= debug.usePostMessage %>
      addListener(win, MESSAGE_EVENT, processMessage);
    }

  }

  return {

    <%= parent.parentAPI %>

    <%= child.childAPI %>

    VERSION: '<%= pkg.version %>'

  };

}(window));