# TalkIn

TalkIn is an interface providing safe and easy unidirectional cross-document communication.

## Contents

- [Quick Usage](#quick-usage)
- [Why is TalkIn Awesome?](#why-is-talkin-awesome)
- [Browser Support](#browser-support)
- [Configuring, Building, and Demoing](#configuring-building-demoing)
- [Versions](#versions)
- [API](#api)



## <a class="anchor" href="#quick-usage" id="quick-usage"></a>Quick Usage

### First off...

Make sure you have [configured and built TalkIn](#configuring-building-demoing).

### In the Parent Document

Load TalkIn:

```html
<script src="path/to/talkin-parent.min.js"></script>
```

Register an endpoint to be called:
```js
LI.TalkIn.register('alertMessage', function(data) {
  alert(data.message);
});
```

### In the Child Document

Load TalkIn:

```html
<script src="path/to/talkin-child.min.js"></script>
```

Call the endpoint registered in the parent:

```js
LI.TalkIn.send('alertMessage', {
  message: 'Salsa Shark'
});
```



## <a class="anchor" href="#why-is-talkin-awesome" id="why-is-talkin-awesome"></a>Why is TalkIn Awesome?

Because it is:

- **Flexible**
  - Send messages without providing a target origin.
  - Recieve messages from infinitely nested iframes.
  - Intelligently selects the best method for communication.


- **Safe**
  - Employs postMessage best practices (origin whitelisting and explicit targetOrigins).
  - Messages are digested in whitelisted endpoints.
  - Hardened to combat XSS threats.


- **Quick**
  - Minimal execution time and lazily-loaded components.
  - Less than 3K minified (talkin-parent.js).
  - Simple to learn and use.


Due to it's origin flexibility, TalkIn is especially suited for modules and widgets that appear across sites containing multiple subdomains and protocols:

- Rich ads
- AJAX dialogs (login boxes, upload forms, etc.)
- Pretty much anything that may not have specific parent origin knowledge.



## <a class="anchor" href="#browser-support" id="browser-support"></a>Browser Support

TalkIn is designed to work in a wide variety of browsers, old and new. It is performance optimised for modern browsers that support postMessage (http://caniuse.com/x-doc-messaging), but the fallback will work in browsers all the way back to IE6.



## <a class="anchor" href="#configuring-building-demoing" id="configuring-building-demoing"></a>Configuring, Building, and Demoing

1. Ensure you have [Node](http://www.nodejs.org) and [Grunt](http://www.gruntjs.com) installed, clone the repository, and then `npm install` to fetch the dependencies.

2. Edit `config/config.yaml` with your environment's information before building. See the comments in the config file; specifically, you'll need to:
  - Add origins to the whitelist.
  - Update paths to necessary legacy support files (which you'll need to copy to your server).

3. Run `grunt` to build. This will output files to the `/dist` directory. (There are a few different [versions](#versions), each suited for a specific use case.)

4. To view the demos, run `grunt server` and navigate to http://localhost:9090/.



## <a class="anchor" href="#versions" id="versions"></a>Versions

The following versions of TalkIn are built by running `grunt`:

- `talkin-parent.js`: For use in the parent document. Excludes the 'send' API.
- `talkin-child.js`: For use in the child document. Excludes the 'register' API.
- `talkin-debug.js`: Includes all APIs and logs output out to console. Perfect for troubleshooting.
- `talkin-demo.js`: A version of talkin-debug.js excluding origin whitelisting. Legacy support is configured for the included demo server environment.
- `talkin-parent.min.js`: An uglified version of `talkin-parent.js`.
- `talkin-child.min.js`: An uglified version of `talkin-child.js`.


## <a class="anchor" href="#api" id="api"></a>API

### register `Parent API`
```js
LI.Talkin.register(methodName, endpoint)
```
Registers an endpoint to be invoked by the child document. The endpoint can either be a function or an object that exposes functions, which is useful for organizing a collection of similar methods.

#### Arguments

`methodName {String}`: The name of the function or object (the latter acting as a namespace for attached methods).

`endpoint {Function || Object}`: The function or object methods exposed to be invoked.

#### Examples

```js
// Registering a function (basic):
LI.TalkIn.register('processNumber', function(data) {
  doSomethingWith(data.number);
});
 
// Registering an object (advanced):
// Note that only functions directly attached to the object can be invoked
// by TalkIn, effectively allowing for only a single namespace.
// (E.G. 'pizza.eat')
LI.TalkIn.register('list', (function() {
  var list = document.getElementById('my-list');
  return {
    update: function(data) {
      updateItem(list, data.itemId);
    },
    destroy: function(data) {
      destroyItem(list, data.itemId);
    }
  };
}()));
```



### send `Child API`
```js
LI.TalkIn.send(methodName, data)
```
Transports a data object from the child to an endpoint registered in the parent document.

#### Arguments

`methodName {String}`: The name of the method to invoke. Note that dot notation is used for methods on a registered object (see example below).

`data {Object}`: A JSON structure passed to the method.

#### Examples

```js
// Invoke a function (basic):
LI.TalkIn.send('processNumber', {
  number: 42
});
 
// Invoke a method on an object (advanced):
// Note that only functions one namespace deep are allowed.
LI.TalkIn.send('list.update', {
  itemId: 'list-item-7'
});
```



### getQueryParams `Child API`
```js
LI.TalkIn.getQueryParams()
```
A helper function that grabs the window's query string and convert it into a friendly object. This also grabs DoubleClick params, which are semicolon-separated key-value pairs that appear before the location search.

#### Arguments

None.

#### Returns

`{Object}` containing a key-value map of all the query and DoubleClick params.



### addListener `Child API`
```js
LI.TalkIn.addListener(el, evt, fn)
```
Adds an event listener to an element. Used internally, `addListener` is exposed as a convenience method in environments where libraries like jQuery are unavailable.

#### Arguments

`el {Object}`: The element the listener will be attached to.

`evt {String}`: The event type to listen for.

`fn {Function}`: The function to be called when the event fires.



### removeListener `Child API`
```js
LI.TalkIn.removeListener(el, evt, fn)
```
Removes an event listener from an element. Used internally, `removeListener` is exposed as a convenience method in environments where libraries like jQuery are unavailable.

#### Arguments

`el {Object}`: The element to remove the listener from.

`evt {String}`: The event type to remove.

`fn {Function}`: The function to remove.