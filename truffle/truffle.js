module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    ganache: {
      host: 'ganache',
      port: 7545,
      network_id: '1234'
    }
  },
  mocha: {
    useColors: true,
    reporter: 'eth-gas-reporter'
  }
}
