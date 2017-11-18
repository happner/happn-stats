global.Promise = global.Promise || require('bluebird');
module.exports = ExamplePlugin;

var debug = require('debug')('happn-stats:example-plugin');

function ExamplePlugin(server) {
  this.server = server;
}

ExamplePlugin.prototype.start = function () {
  var _this = this;
  return new Promise(function (resolve, reject) {
    debug('start');

    _this.server.on('report', function (timestamp, metrics) {
      console.log(timestamp, metrics);
    });

    resolve();
  });
}

ExamplePlugin.prototype.stop = function () {
  return new Promise(function (resolve, reject) {
    debug('stop');
    resolve();
  });
}
