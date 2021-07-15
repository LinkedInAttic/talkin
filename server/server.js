var	http				= require('http'),
		https				= require('https'),
		fs					= require('fs'),
		static			= require('node-static'),
	
		httpPort		= 9090,
		httpsPort		= 9443,

		file = new static.Server("../", { cache: 1 }),

		options = {
			key: fs.readFileSync("keys/privatekey.pem"),
			cert: fs.readFileSync("keys/certificate.pem")
		};

http.createServer(function(request, response) {
	file.serve(request, response);
}).listen(httpPort);

https.createServer(options, function(request, response) {
	file.serve(request, response);
}).listen(httpsPort);

console.log('### TalkIn example server is running:');
console.log('### View demos on http://localhost:' + httpPort + '/demo');
console.log('### Run tests on http://localhost:' + httpPort + '/test');