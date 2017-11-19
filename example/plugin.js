global.Promise = global.Promise || require('bluebird');
module.exports = ExamplePlugin;

var debug = require('debug')('happn-stats:example-plugin');

function ExamplePlugin(happnStatsServer) {
  this.happnStatsServer = happnStatsServer;
}

ExamplePlugin.prototype.start = function () {
  var _this = this;
  return new Promise(function (resolve, reject) {
    debug('start');

    _this.happnStatsServer.on('report', function (timestamp, metrics) {
      console.log();
      console.log(timestamp);
      for (var name in metrics.gauges) {
        console.log(name, ':', metrics.gauges[name]);
      }
      for (var name in metrics.counters) {
        console.log(name, ':', metrics.counters[name]);
      }
      console.log();
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
