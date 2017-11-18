module.exports = StatsServer;

var debug = require('debug')('xstats:server');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var Server = require('ws').Server;

function StatsServer(opts) {
  opts = opts || {};
  this.host = opts.host || '0.0.0.0';
  this.port = opts.port || 49494;
  this.flushInterval = opts.flushInterval || 1000;
  this.clear();
}

util.inherits(StatsServer, EventEmitter);

StatsServer.prototype.start = function () {
  var _this = this;
  return new Promise(function (resolve, reject) {
    _this.server = new Server({
      host: _this.host,
      port: _this.port,
      verifyClient: function (info) {
        // TODO: auth & https later if needed
        return true;
      }
    });

    function onListening() {
      var address = _this.server._server.address();
      debug('listening at %s:%s', address.address, address.port);
      _this.server.removeListener('error', onStartError);
      _this.server.on('error', _this._onError.bind(_this));
      _this.server.on('connection', _this._onConnection.bind(_this));
      _this.interval = setInterval(_this._report.bind(_this), _this.flushInterval);
      resolve();
    }

    function onStartError(err) {
      _this.server.removeListener('listening', onListening);
      reject(err);
    }

    _this.server.once('error', onStartError);
    _this.server.once('listening', onListening);

    resolve();
  });
}

StatsServer.prototype.stop = function () {
  var _this = this;
  clearInterval(this.interval);
  return new Promise(function (resolve, reject) {
    if (!_this.server) return resolve();
    _this.server.close(function (e) {
      if (e) return reject(e);
      resolve();
    });
  });
}

StatsServer.prototype.clear = function () {
  this.accumMetrics = {
    counters: {},
    gauges: {}
  }
  this.metrics = {
    counters: {},
    gauges: {}
  }
}

StatsServer.prototype._onError = function (err) {
  console.error(err);
}

StatsServer.prototype._onConnection = function (socket) {
  debug('connection from %s', socket._socket.remoteAddress);
  socket.send(JSON.stringify({flushInterval: this.flushInterval}));
  socket.onmessage = this._onMessage.bind(this);
  socket.onclose = function onClose() {
    debug('disconnection from %s', socket._socket.remoteAddress);
  }
}

StatsServer.prototype._onMessage = function (messageEvent) {
  var data = JSON.parse(messageEvent.data);
  if (data.metrics) return this._onMetrics(data);
}

StatsServer.prototype._onMetrics = function (data) {
  var metrics = data.metrics;
  var accum = this.accumMetrics;

  for (var name in metrics.counters) {
    accum.counters[name] = accum.counters[name] || 0;
    accum.counters[name] += metrics.counters[name];
  }

  for (var name in metrics.gauges) {
    accum.gauges[name] = accum.gauges[name] || { count: 0, total: 0 };
    accum.gauges[name].count += metrics.gauges[name].count;
    accum.gauges[name].total += metrics.gauges[name].total;
  }

  this.emit('fragment', data.name, data.period, data.metrics);
}

StatsServer.prototype._report = function () {
  var accum = this.accumMetrics;
  var metrics = this.metrics;
  var value;

  for (var name in accum.counters) {
    metrics.counters[name] = accum.counters[name] * 1000 / this.flushInterval;
  }

  for (var name in accum.gauges) {
    metrics.gauges[name] = accum.gauges[name].total / accum.gauges[name].count;
  }

  this.emit('report', Date.now(), JSON.parse(JSON.stringify(metrics)));
  this._reset();
}

StatsServer.prototype._reset = function () {
  this.accumMetrics = {
    counters: {},
    gauges: {}
  }
  for (var name in this.metrics.counters) {
    this.metrics.counters[name] = 0;
    // gauges remain at current value
  }
}
