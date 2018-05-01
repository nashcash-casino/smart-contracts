const ChipTreasury = artifacts.require('./ChipTreasury.sol')

const unit = require('ethjs-unit')
const Promise = require('bluebird')

module.exports = function (deployer, network, [owner, ...acounts]) {
  deployer.then(async () => {
    try {
      // deploy contract
      await deployer.deploy(ChipTreasury)

      // store contract instance as variable
      const chipTreasury = await ChipTreasury.deployed()

      // mint some chips
      const chipData = require('../test/mockChipData')(25)
      await Promise.each(chipData, chip =>
        chipTreasury.mintChip(chip.hashWithHexPrefix, { from: owner })
      )
      console.log(JSON.stringify(chipData, null, 2))

      // send ether to the contract
      await chipTreasury.send(unit.toWei(1, 'ether'), { from: owner })

      // unpause the contract
      await chipTreasury.unpause({ from: owner })
    } catch (err) {
      console.log(err)
    }
  })
}
