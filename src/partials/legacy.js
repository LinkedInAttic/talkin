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

    <%= debug.beginLegacySupport %>

    // Begin loading JSON library unless the dynamic script element already exists.
    if (!doc.getElementById(scriptId) && !hasJSON) {

      <%= debug.createJSONScript %>

      head = doc.getElementsByTagName('head')[0];
      if (head) {
        script = doc.createElement('script');
        script.id = scriptId;
        script.src = '<%= config.legacy.json %>';
        script.type = 'text/javascript';
        head.appendChild(script);
      }
    }

    // Create a container and place all our iframes in it.
    if (!doc.getElementById(containerId)) {

      <%= debug.createIframeContainer %>

      container = doc.createElement('div');
      container.id = containerId;

      while (numberOfOrigins--) {

        <%= debug.createIframe %>

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
          <%= config.legacy.whitelist %>
        ],
        path = '<%= config.legacy.sendfile %>#',
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
      <%= debug.legacyNotReady %>
      configureLegacySupport(data, len);
      return;
    }

    container = doc.getElementById('TALKIN_LEGACY_CONTAINER');
    if (container) {
      iframes = container.getElementsByTagName('iframe');
    }

    if (iframes) {
      <%= debug.setIframeSrcs %>
      data = '#' + encodeURIComponent(JSON.stringify(data));
      while (len--) {
        // We need to cache bust the source to refresh the iframe.
        iframes[len].src = validateURL(possibleParentOrigins[len] + path + Math.random().toString().slice(2) + data);
      }
    }
  }