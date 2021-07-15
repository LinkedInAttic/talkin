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

(function(win) {

  var DATA_SRC = 'data-src',
      ORIGIN = '{$origin}',
      MATCHORIGIN = '?matchorigin',

      doc = win.document,
      loc = win.location,
      matchOrigin = loc.search.slice(1).toLowerCase() === MATCHORIGIN.slice(1),
      origin = determineOrigin(loc.protocol + '//' + loc.host),
      iframes = doc.getElementsByTagName('iframe'),
      len = iframes.length,
      dataSrc,
      element,
      anchors;

  function determineOrigin(origin) {

    var HTTP_PORT = ':9090',
        HTTPS_PORT = ':9443',
        HTTP = 'http:',
        HTTPS = 'https:';

    if (!matchOrigin) {
      if (origin.indexOf(HTTP) !== -1) {
        return origin.replace(HTTP, HTTPS).replace(HTTP_PORT, HTTPS_PORT);
      }
      else {
        return origin.replace(HTTPS, HTTP).replace(HTTPS_PORT, HTTP_PORT);
      }
    }
    return origin;
  }

  while (len--) {
    element = iframes[len];
    dataSrc = element.getAttribute(DATA_SRC);
    if (dataSrc) {
      element.src = dataSrc.replace(ORIGIN, origin);
    }
  }

  if (matchOrigin) {
    anchors = doc.getElementsByTagName('a');
    len = anchors.length;
    while (len--) {
      element = anchors[len];
      element.href += MATCHORIGIN;
    }
  }

}(window));