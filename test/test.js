var expect = require('expect.js');
var StatsServer = require('../').StatsServer;
var StatsClient = require('../').StatsClient;

describe('happn-stats', function () {

  before('start server', function (done) {
    this.server = new StatsServer({
      flushInterval: 1000
    });
    this.server.start().then(done).catch(done);
  });

  before('start client', function (done) {
    this.client = new StatsClient({ name: 'xx' });
    setTimeout(done, 500);
  });

  beforeEach(function (done) {
    var _this = this;
    setTimeout(function () {
      _this.server.clear();
      done();
    }, 500);
  });

  after('stop client', function (done) {
    this.client.stop();
    done();
  });

  after('stop server', function (done) {
    this.server.stop().then(done).catch(done);
  });

  it('reports fragments', function (done) {
    this.timeout(3000);
    var _this = this;
    var fragment = {};

    this.server.on('fragment', function (name, period, metrics) {
      fragment.name = name;
      fragment.period = period;
      fragment.metrics = metrics;
    });

    var interval = setInterval(function () {
      _this.client.increment('counter1');
      _this.client.gauge('gauge1', 0.5);
    }, 20);

    setTimeout(function () {
      clearInterval(interval);

      expect(fragment.name).to.be('xx');
      expect(fragment.period).to.be(200);
      expect(fragment.metrics.counters.counter1).to.be.greaterThan(7);
      var gauge1 = fragment.metrics.gauges.gauge1;
      expect(gauge1.count).to.be.greaterThan(7);
      expect(gauge1.total / gauge1.count).to.be(0.5);

      done();
    }, 2000);

  });

  it('reports metrics', function (done) {
    this.timeout(3000);
    var _this = this;
    var metrics;

    this.server.on('report', function (timestamp, _metrics) {
      metrics = _metrics;
    });

    var interval = setInterval(function () {
      _this.client.increment('counter2');
      _this.client.gauge('gauge2', 0.5);
    }, 20);

    setTimeout(function () {
      clearInterval(interval);

      // cleared in before hook
      expect(metrics.counters.counter1).to.be(undefined);
      expect(metrics.gauges.gauge1).to.be(undefined);

      expect(metrics.counters.counter2).to.be.greaterThan(40);
      expect(metrics.gauges.gauge2).to.be(0.5);

      done();
    }, 2000);


  });

});
