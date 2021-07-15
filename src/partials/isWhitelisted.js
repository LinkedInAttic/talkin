/**
   * Checks to see if the given origin is whitelisted for cross-document communication.
   *
   * @param  {String}  origin The origin you wish to check.
   *
   * @return {Boolean}        Returns true if the given origin is whitelisted.
   */
  function isWhitelistedOrigin(origin) {
    var len = WHITELIST.length,
        hashedOrigin = hash(origin);
    while (len--) {
      if (WHITELIST[len] === hashedOrigin) {
        return true;
      }
    }
    return false;
  }