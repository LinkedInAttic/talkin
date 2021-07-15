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
      
      <%= debug.sendInvoked %>
      
      // If the endpointNamespace is set, the parent and child are on indentical origins.
      // Just call the parent's method directly.
      if (endpointNamespace && endpointOrData) {
        <%= debug.sendUseNamespace %>
        invokeEndpoint(endpointOrData, data);
      }
      
      // Otherwise we'll use postMessage ... or the legacy fallback.
      else {

        // Package data into a bulk call if not already.
        if (data) {
          endpointOrData = bulkify(endpointOrData, data);
        }

        // If this is a modern browser, then sweet! Use postMessage.
        if (hasPostMessage) {
          <%= debug.sendUsePostMessage %>

          // If the remoteOrigin is set, that means the parent and child successfully shook hands.
          if (remoteOrigin) {
            windowTop.postMessage(JSON.stringify(endpointOrData), remoteOrigin);
          }

          // Otherwise, try establishing the handshake again. The child probably loaded before the parent.
          // Cache the data so it can be sent when the connection is established.
          else {
            cachedData.push(endpointOrData);

            if (!handshakeInterval) {

              <%= debug.sendRemoteOriginNotSet %>

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
        }

        // Otherwise, this is probably an old version of IE. Time to get nuts.
        else {
          <%= debug.sendUseLegacyFallback %>
          sendLegacyMessage(endpointOrData);
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