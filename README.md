[![npm](https://img.shields.io/npm/v/happn-stats.svg)](https://www.npmjs.com/package/happn-stats)[![Build Status](https://travis-ci.org/happner/happn-stats.svg?branch=master)](https://travis-ci.org/happner/happn-stats)[![Coverage Status](https://coveralls.io/repos/github/happner/happn-stats/badge.svg?branch=master)](https://coveralls.io/github/happner/happn-stats?branch=master)

# happn-stats

Lightweight application monitoring. Works with all versions of nodejs.

Includes CLI with plugin functionality. See `example/plugin` or [happn-stats-elasticsearch](https://github.com/happner/happn-stats-elasticsearch).

```
npm install happn-stats --global
happn-stats -h
```

Includes Client and Server APIs

```javascript
const happnStats = require('happn-stats');
const StatsClient = happnStats.StatsClient;
const StatsServer = happnStats.StatsServer;
```

## class StatsClient

This is the clientside metrics collection agent. It has methods for incrementing counters and setting gauge values to be sent to [StatsServer](#class-statsserver) instance.

### new StatsClient([options])

* `options`
  * `host` \<string> IP address or hostname of StatsServer (default localhost)
  * `port` \<number> Optional port at which StatsServer is listening (default 49494)
  * `name` \<string> Optional name of this client instance (default untitled).
* Returns \<StatsClient>

### statsClient.stop()

Stops the client. This closes the websocket and clears some timers.

### statsClient.increment(counterName[, value])

* `counterName` \<string> The name of the counter to increment.
* `value` \<number> Optional value to increment by (default 1)

Counters are auto created when incremented.

### statsClient.gauge(gaugeName, value)

* `gaugeName` \<string> The name of the gauge to set.
* `value` \<number> The value to set.

Guages are auto created when set.

##### Example1

```javascript
const StatsClient = require('happn-stats').StatsClient;

const statsClient = new StatsClient({
  host: '172.44.1.2' // to StatsServer instance
});

statsClient.increment('counter_name');
statsClient.gauge('gauge_name', 0.5);

// at app shutdown
statsClient.stop();
```



## class StatsServer

This is the serverside metrics collection and aggregation agent. It reports counter and gauge metrics from all connected clients.

### new StatsServer([options])

* `options`
  * `host` \<string> Optional address to listen (default 0.0.0.0)
  * `port` \<number> Optional port to listen (default 49494)
  * `reportInterval` \<number> Optional interval in milliseconds to emit reports (default 10000)
  * `fragmentsPerReport` \<number> Optional fragments per report interval (default 5)
* Returns \<StatsServer>

The `reportInterval` and `fragmentsPerReport` control how frequently the clients send collected metrics to the server. The default will be every `10000 / 5` milliseconds.

`StatsServer` is an EventEmitter with the following events.

### Event: 'report'

* `timestamp` \<number> The time of the report as EPOCH milliseconds
* `metrics`
  * `counters` \<Object> The aggregated list of counters with per-second values.
  * `gauges` \<Object> The aggregated list of gauges with values.

This event is emitted every `reportInterval`. Counters are aggregated into per-second values. Counters that have gone silent at the clients remain in the report with 0 values. Gauges that have gone silent at the clients remain in the report at their last known value.

### Event: 'fragment'

* `data`
  * `id` \<string> Internal id of the client from which this aggregation fragment originated.
  * `name` \<string> Name of the client as configured in `StatsClient` constructor.
  * `timestamp` \<number> Remote starting time of fragment
  * `period` \<number> Time in milliseconds over which the metrics in this fragment were collected
  * `metrics `\<Object> The metrics

This event is emitted with every metrics fragment arriving from the each client.

### statsServer.start()

* Returns \<Promise> Resolves with server instance.

Start the server.

### statsServer.stop()

* Return \<Promise> 

Stops the server.

### statsServer.clear()

Clears all metrics.