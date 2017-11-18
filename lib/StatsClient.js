module.exports = StatsClient;

var debug = require('debug')('happn-stats:client');
var WebSocket = require('ws');

function StatsClient(opts) {
  opts = opts || {};
  this.host = opts.host || 'localhost';
  this.port = opts.port || 49494;
  this.name = opts.name || 'untitled';
  this._connect();
  this.metrics = {
    counters: {},
    gauges: {}
  }
}

StatsClient.prototype.stop = function () {
  clearTimeout(this.timeout);
  clearInterval(this.interval);
  this.stopping = true;
  if (this.ws) this.ws.close();
}

StatsClient.prototype.increment = function (counterName, count) {
  if (typeof count == 'undefined') count = 1;
  var counters = this.metrics.counters;
  counters[counterName] = counters[counterName] || 0;
  counters[counterName] += count;
}

StatsClient.prototype.gauge = function (gaugeName, value) {
  var gauges = this.metrics.gauges;
  gauges[gaugeName] = gauges[gaugeName] || { count: 0, total: 0 };
  gauges[gaugeName].count++;
  gauges[gaugeName].total += value;
}

StatsClient.prototype._report = function () {
  var ws = this.ws;
  var now = Date.now();
  if (ws && ws.readyState == 1) {
    ws.send(JSON.stringify({
      id: this.id,
      name: this.name,
      timestamp: this.timestamp,
      period: now - this.timestamp,
      metrics: this.metrics
    }));
  }
  this.timestamp = now;
  this.metrics.counters = {};
  this.metrics.gauges = {};
}

StatsClient.prototype._connect = function () {
  var _this = this;
  var url = 'ws://' + _this.host + ':' + _this.port;
  var ws;

  debug('attempting %s', url)
  ws = new WebSocket(url);

  ws.onmessage = this._onMessage.bind(this);

  ws.onerror = function onError(err) {
    // more noise on this?
    debug('socker error', err);
  }

  ws.onopen = function onOpen() {
    debug('connected');
    _this.ws = ws;
  }

  ws.onclose = function onClose() {
    debug('disconnected');
    delete _this.ws;
    if (_this.stopping) return;
    _this.timeout = setTimeout(_this._connect.bind(_this), 2000);
  }
}

StatsClient.prototype._onMessage = function (messageEvent) {
  var data = JSON.parse(messageEvent.data);

  if (data.fragmentInterval) {
    this._reset(data.fragmentInterval);
  }

  if (data.id) {
    this.id = data.id;
  }
}

StatsClient.prototype._reset = function (fragmentInterval) {
  debug('setting fragment interval %d', fragmentInterval);
  clearInterval(this.interval);
  this.timestamp = Date.now();
  this.metrics.counters = {};
  this.metrics.gauges = {};

  this.interval = setInterval(this._report.bind(this), fragmentInterval);

}
