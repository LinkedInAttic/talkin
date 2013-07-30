// Available endpoints that can be accessed by TalkIn.
    endpoints: {},

    /**
     * Register an endpoint to be accessed by the child. The endpoint can either be
     * a function or an object that exposes functions---the latter being useful for
     * organizing a collection of similar methods.
     *
     * @param  {String}               methodName The name of the endpoint to access.
     * @param  {Function || Object}   endpoint   The function to invoke or an object
     *                                           that exposes functions to invoke.
     */
    register: function(methodName, endpoint) {
      if (methodName && endpoint && endpoint instanceof Object) {
        this.endpoints[methodName] = endpoint;
      }
    },