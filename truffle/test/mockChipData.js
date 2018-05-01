const faker = require('faker')
const { keccak256 } = require('js-sha3')

module.exports = function (chipsToMint = 10) {
  const chips = []

  for (let id = 0; id < chipsToMint; id++) {
    const chip = {}

    chip.id = id
    chip.password = faker.random.alphaNumeric(16)
    chip.hash = keccak256(chip.password)
    chip.hashWithHexPrefix = '0x' + chip.hash

    chips.push(chip)
  }

  return chips
}
