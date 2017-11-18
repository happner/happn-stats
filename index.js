global.Promise = global.Promise || require('bluebird');

module.exports = {
  StatsServer: require('./lib/StatsServer'),
  StatsClient: require('./lib/StatsClient')
}
