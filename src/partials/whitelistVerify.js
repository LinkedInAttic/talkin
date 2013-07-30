// If the origin is not whitelisted, silently exit.
    if (!isWhitelistedOrigin(evt.origin)) {
      <%= debug.originNotWhitelisted %>
      return;
    }