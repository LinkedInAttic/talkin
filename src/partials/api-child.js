    /**
      * Transports a data object from the child to the desired endpoint in the parent.
      *
      * @param {String} methodName    The registered method you wish to invoke.
      * @param {Object} data        An object containing the JSON you wish to deliver.
      */
    send: function(methodName, data) {

      // You can't send from the top-most parent.
      if (isTopWindow) {
        return;
      }
      
      <%= debug.sendInvoked %>
      
      // If the endpointNamespace is set, the parent and child are on indentical origins.
      // Just call the parent's method directly.
      if (endpointNamespace && methodName) {
        <%= debug.sendUseNamespace %>
        invokeEndpoint(methodName, data);
      }
      
      // Otherwise we'll use postMessage ... or a the legacy fallback.
      else {

        // Append the methodName to the data object so the other methods know what to call.
        data[ENDPOINT_PROPERTY] = methodName;

        // If this is a modern browser, then sweet! Use postMessage.
        if (hasPostMessage) {
          <%= debug.sendUsePostMessage %>

          // If the remoteOrigin is set, that means the parent and child successfully shook hands.
          if (remoteOrigin) {
            windowTop.postMessage(JSON.stringify(data), remoteOrigin);
          }

          // Otherwise, try establishing the handshake again. The child probably loaded before the parent.
          // Cache the data so it can be sent when the connection is established.
          else if (!handshakeInterval) {

            <%= debug.sendRemoteOriginNotSet %>

            cachedData = data;
            handshakeInterval = win.setInterval(function() {

              <%= debug.sendAttemptingHandshake %>

              windowTop.postMessage(READY_MESSAGE, '*');
              
              if (!(handshakeTimeout--)) {
                <%= debug.handshakeFailed %>
                win.clearInterval(handshakeInterval);
              }
            }, 100);
          }
        }

        // Otherwise, this is probably an old version of IE. Time to get nuts.
        else {
          <%= debug.sendUseLegacyFallback %>
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