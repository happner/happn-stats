module.exports = StatsServer;

var debug = require('debug')('happn-stats:server');
var Promise = global.Promise || require('bluebird');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var shortid = require('shortid');
var Server = require('ws').Server;

function StatsServer(opts) {
  opts = opts || {};
  this.host = opts.host || '0.0.0.0';
  this.port = opts.port || 49494;
  this.reportInterval = opts.reportInterval || 10000;
  this.fragmentsPerReport = opts.fragmentsPerReport || 5;
  this.fragmentCounter = 0;
  this.bytesCounter = 0;
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
      _this.interval = setInterval(_this._report.bind(_this), _this.reportInterval);
      resolve(_this);
    }

    function onStartError(err) {
      _this.server.removeListener('listening', onListening);
      reject(err);
    }

    _this.server.once('error', onStartError);
    _this.server.once('listening', onListening);
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
  // more noise on this?
  debug('server error', err);
}

StatsServer.prototype._onConnection = function (socket) {
  var _this = this;
  var id = this._getId();
  socket.id = id;
  debug('connection from %s', socket._socket.remoteAddress);
  socket.send(JSON.stringify({
    id: id,
    fragmentInterval: this.reportInterval / this.fragmentsPerReport
  }));
  socket.onmessage = this._onMessage.bind(this);
  socket.onclose = function onClose() {
    _this._remove(socket.id);
    debug('disconnection from %s', socket._socket.remoteAddress);
  }
  socket.onerror = function (err) {
    debug('socket error', err);
  }
}

StatsServer.prototype._getId = function () {
  var id = shortid.generate();
  var clients = this.server.clients;
  for (var i = 0; i < clients.length; i++) {
    if (id == clients[i].id) return this._getId();
  }
  return id;
}

StatsServer.prototype._remove = function (id) {
  for (var name in this.accumMetrics.counters) {
    delete this.accumMetrics.counters[name][id];
  }
}

StatsServer.prototype._onMessage = function (messageEvent) {
  var data = JSON.parse(messageEvent.data);
  this.bytesCounter += messageEvent.data.length;
  if (data.metrics) return this._onMetrics(data);
}

StatsServer.prototype._onMetrics = function (data) {
  var metrics = data.metrics;
  var accum = this.accumMetrics;
  var counter;

  for (var name in metrics.counters) {
    counter = accum.counters[name] = accum.counters[name] || {};
    counter[data.id] = counter[data.id] || [];
    counter[data.id].push({ period: data.period, count: metrics.counters[name] })
  }

  for (var name in metrics.gauges) {
    accum.gauges[name] = accum.gauges[name] || { count: 0, total: 0 };
    accum.gauges[name].count += metrics.gauges[name].count;
    accum.gauges[name].total += metrics.gauges[name].total;
  }

  this.fragmentCounter++;
  this.emit('fragment', data);
}

StatsServer.prototype._report = function () {
  var accum = this.accumMetrics;
  var metrics = this.metrics;
  var value;

  for (var name in accum.counters) {
    metrics.counters[name] = this._processCounter(accum.counters[name]);
  }

  for (var name in accum.gauges) {
    metrics.gauges[name] = accum.gauges[name].total / accum.gauges[name].count;
  }

  metrics.gauges._clients = this.server.clients.length;
  metrics.counters._fragments = this._round(this.fragmentCounter / this.reportInterval * 1000);
  metrics.counters._bytes = this._round(this.bytesCounter / this.reportInterval * 1000);

  this.fragmentCounter = 0;
  this.bytesCounter = 0;

  this.emit('report', Date.now(), JSON.parse(JSON.stringify(metrics)));
  this._reset();
}

StatsServer.prototype._processCounter = function (accum) {
  var clients = [];
  var frags;
  var period;
  var count;

  for (var id in accum) {
    period = 0;
    count = 0;
    frags = accum[id];
    for (var i = 0; i < frags.length; i++) {
      period += frags[i].period;
      count += frags[i].count;
    }
    frags.length = 0;
    if (count) {
      clients.push(count / period * 1000);
    } else {
      clients.push(0);
    }
  }

  return this._round(clients.reduce(_add, 0));
}

StatsServer.prototype._round = function (num) {
  num = Math.round(num * 1000);
  return num / 1000;
}

StatsServer.prototype._reset = function () {
  this.accumMetrics.gauges = {};
  for (var name in this.metrics.counters) {
    this.metrics.counters[name] = 0;
    // gauges remain at current value
  }
}

function _add(a, b) {
  return a + b;
}
