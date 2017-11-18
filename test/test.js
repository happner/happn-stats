var expect = require('expect.js');
var StatsServer = require('../').StatsServer;
var StatsClient = require('../').StatsClient;

describe('happn-stats', function () {

  before('start server', function (done) {
    this.server = new StatsServer({
      reportInterval: 1000
    });
    this.server.start()
      .then(function () {
        done();
      })
      .catch(done);
  });

  beforeEach(function (done) {
    var _this = this;
    setTimeout(function () {
      _this.server.clear();
      done();
    }, 500);
  });

  after('stop server', function (done) {
    this.server.stop().then(done).catch(done);
  });

  context('fragments', function () {

    before('start client', function (done) {
      this.client = new StatsClient({ name: 'xx' });
      setTimeout(done, 100);
    });

    after('stop client', function (done) {
      this.client.stop();
      done();
    });

    it('emits fragments', function (done) {
      this.timeout(3000);
      var _this = this;
      var fragment;

      this.server.on('fragment', function (_fragment) {
        fragment = _fragment;
      });

      var interval = setInterval(function () {
        _this.client.increment('counter1');
        _this.client.gauge('gauge1', 0.5);
      }, 20);

      setTimeout(function () {
        clearInterval(interval);

        expect(fragment.name).to.be('xx');
        expect(fragment.period).to.be.greaterThan(195);
        expect(fragment.period).to.be.lessThan(210);
        expect(fragment.metrics.counters.counter1).to.be.greaterThan(7);
        var gauge1 = fragment.metrics.gauges.gauge1;
        expect(gauge1.count).to.be.greaterThan(7);
        expect(gauge1.total / gauge1.count).to.be(0.5);

        done();
      }, 2000);

    });

  });

  context('reports', function () {

    before('start client 1', function (done) {
      this.client1 = new StatsClient({ name: 'xx' });
      setTimeout(done, 100);
    });

    before('start client 2', function (done) {
      this.client2 = new StatsClient({ name: 'xx' });
      setTimeout(done, 100);
    });

    before('start client 3', function (done) {
      this.client3 = new StatsClient({ name: 'xx' });
      setTimeout(done, 100);
    });

    after('stop client 1', function (done) {
      this.client1.stop();
      done();
    });

    after('stop client 2', function (done) {
      this.client2.stop();
      done();
    });

    after('stop client 3', function (done) {
      this.client3.stop();
      done();
    });

    it('reports metrics', function (done) {
      this.timeout(3000);
      var _this = this;
      var metrics;

      this.server.on('report', function (timestamp, _metrics) {
        metrics = _metrics;
      });

      var interval1 = setInterval(function () {
        _this.client1.increment('counter2');
        _this.client1.gauge('gauge2', 0.5);
        _this.client2.increment('counter2');
        _this.client2.gauge('gauge2', 0.5);
        _this.client3.increment('counter2');
        _this.client3.gauge('gauge2', 0.5);
      }, 20);



      setTimeout(function () {
        clearInterval(interval1);

        // cleared in before hook
        expect(metrics.counters.counter1).to.be(undefined);
        expect(metrics.gauges.gauge1).to.be(undefined);

        expect(metrics.counters.counter2).to.be.greaterThan(120);
        expect(metrics.counters.counter2).to.be.lessThan(151);
        expect(metrics.gauges.gauge2).to.be(0.5);

        done();
      }, 2000);


    });

  });

});
