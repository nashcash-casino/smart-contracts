/* eslint-env mocha */
const Eth = require('ethjs-query')
const unit = require('ethjs-unit')
const BigNumber = require('bignumber.js')
const HttpProvider = require('ethjs-provider-http')
const Promise = require('bluebird')

const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const assert = chai.assert

const chipData = require('./mockChipData')()
const eth = new Eth(new HttpProvider('http://localhost:7545'))
const ether = 1
const centiEther = Number(unit.fromWei(unit.unitMap.milli, 'ether')) * 10

const { promisifyAll } = Promise
const ChipTreasury = promisifyAll(artifacts.require('ChipTreasury'))

contract('ChipTreasury', ([owner, ...accounts]) => {
  let chipTreasury // deployed instance
  beforeEach('setup contract for each test', async () => {
    // deploy new treasury and seed with 1 ether
    chipTreasury = await ChipTreasury.new({ from: owner })
    await chipTreasury.send(unit.toWei(1, 'ether'), { from: owner })
  })

  describe('Ownable', () => {
    it('should have expected owner', async () => {
      const chipTreasury = await ChipTreasury.deployed()
      const currOwner = await chipTreasury.owner.call()
      assert.equal(owner, currOwner)
    })

    it('should allow owner to transfer ownership', async () => {
      const [newOwner] = accounts
      await chipTreasury.transferOwnership(newOwner)
      const currOwner = await chipTreasury.owner.call()
      assert.equal(currOwner, newOwner)
    })

    it('should forbid non-owners to transfer ownership', async () => {
      const [nonOwner] = accounts
      const illegalTransferOwnership = chipTreasury.transferOwnership(
        nonOwner,
        { from: nonOwner }
      )
      assert.isRejected(illegalTransferOwnership)
    })
  })

  describe('Pausable', async () => {
    it('should be paused initially', async () => {
      const paused = await chipTreasury.paused.call()
      assert.isTrue(paused)
    })

    it('should allow owner to unpause', async () => {
      await chipTreasury.unpause({ from: owner })
      const paused = await chipTreasury.paused.call()
      assert.isFalse(paused)
    })

    it('should forbid non-owners to unpause', async () => {
      const [nonOwner] = accounts
      const illegalUnpause = chipTreasury.unpause({ from: nonOwner })
      assert.isRejected(illegalUnpause)
    })
  })

  describe('#mintChip', async () => {
    it('should allow owner to mint a chip', async () => {
      const [chip] = chipData
      const { logs: [eventLog] } = await chipTreasury.mintChip(
        chip.hashWithHexPrefix,
        { from: owner }
      )
      const numChips = await chipTreasury.getNumChips()
      const numChipsMinted = await chipTreasury.numChipsMinted.call()
      const event = eventLog.event
      const chipId = eventLog.args.chipId.toNumber()
      const chipIsClaimed = await chipTreasury.isClaimed(chipId)

      assert.equal(numChips, 1)
      assert.equal(numChipsMinted, 1)
      assert.equal(event, 'ChipMinted')
      assert.equal(chipId, 0)
      assert.isFalse(chipIsClaimed)
    })

    it('should forbid non-owners to mint a chip', async () => {
      const [chip] = chipData
      const [nonOwner] = accounts
      const illegalMintChip = chipTreasury.mintChip(chip.hashWithHexPrefix, {
        from: nonOwner
      })
      assert.isRejected(illegalMintChip)
    })

    it('should allow owner to mint many chips', async () => {
      await Promise.each(chipData, chip =>
        chipTreasury.mintChip(chip.hashWithHexPrefix, { from: owner })
      )

      const numChips = await chipTreasury.getNumChips()
      const numChipsMinted = await chipTreasury.numChipsMinted.call()

      assert.equal(numChips, chipData.length)
      assert.equal(numChipsMinted, chipData.length)
    })
  })

  describe('#claimChip', async () => {
    beforeEach('mint chips and unpause contract before each test', async () => {
      // mint chips
      await Promise.each(chipData, chip =>
        chipTreasury.mintChip(chip.hashWithHexPrefix, { from: owner })
      )
      // unpause contract
      await chipTreasury.unpause({ from: owner })
    })

    it('should allow a user to claim a chip', async () => {
      const [nonOwner] = accounts
      let numChips = new BigNumber(await chipTreasury.getNumChips())
      let chipValue = new BigNumber(await chipTreasury.getChipValue())
      let chipTreasuryBalance = new BigNumber(
        await eth.getBalance(chipTreasury.address)
      )
      let nonOwnerBalance = new BigNumber(await eth.getBalance(nonOwner))

      assert.equal(numChips.toNumber(), chipData.length)
      assert.isTrue(
        chipValue.isEqualTo(chipTreasuryBalance.dividedBy(numChips))
      )

      const [chip] = chipData
      const {
        logs: [claimAttempt, claimSuccess]
      } = await chipTreasury.claimChip(chip.id, chip.password, {
        from: nonOwner
      })

      assert.equal(claimAttempt.event, 'ChipClaimAttempt')
      assert.equal(claimAttempt.args.sender, nonOwner)
      assert.equal(claimAttempt.args.chipId.toNumber(), chip.id)

      assert.equal(claimSuccess.event, 'ChipClaimSuccess')
      assert.equal(claimSuccess.args.sender, nonOwner)
      assert.equal(claimSuccess.args.chipId.toNumber(), chip.id)

      numChips = new BigNumber(await chipTreasury.getNumChips())
      chipValue = new BigNumber(await chipTreasury.getChipValue())
      chipTreasuryBalance = new BigNumber(
        await eth.getBalance(chipTreasury.address)
      )
      const newNonOwnerBalance = new BigNumber(await eth.getBalance(nonOwner))
      assert.equal(numChips.toNumber(), chipData.length - 1)
      assert.isTrue(
        chipValue.isEqualTo(chipTreasuryBalance.dividedBy(numChips))
      )

      const chipValueNum = Number(unit.fromWei(chipValue.toNumber(), 'ether'))
      const receivedEther = Number(
        unit.fromWei(
          newNonOwnerBalance.minus(nonOwnerBalance).toNumber(),
          'ether'
        )
      )
      assert.closeTo(chipValueNum, receivedEther, centiEther)
    })

    it('should allow users to claim every chip', async () => {
      // claim all chips from random user accounts
      await Promise.each(chipData, chip =>
        chipTreasury.claimChip(chip.id, chip.password, {
          from: accounts[Math.floor(Math.random() * accounts.length)]
        })
      )

      const numChips = new BigNumber(await chipTreasury.getNumChips())
      const numChipsMinted = new BigNumber(
        await chipTreasury.numChipsMinted.call()
      )
      const numChipsClaimed = new BigNumber(
        await chipTreasury.numChipsClaimed.call()
      )
      const chipTreasuryBalance = new BigNumber(
        await eth.getBalance(chipTreasury.address)
      )
      assert.equal(numChips.toNumber(), 0)
      assert.equal(numChipsMinted.toNumber(), chipData.length)
      assert.equal(numChipsClaimed.toNumber(), chipData.length)
      assert.equal(chipTreasuryBalance.toNumber(), 0)
    })

    it('should forbid a user from claiming an already claimed chip', async () => {
      const [accountA, accountB] = accounts
      const [chip] = chipData
      await chipTreasury.claimChip(chip.id, chip.password, { from: accountA })
      const illegalClaimChip = chipTreasury.claimChip(chip.id, chip.password, {
        from: accountB
      })
      assert.isRejected(illegalClaimChip)
    })

    it('should forbid a user from claiming a chip on a paused treasury', async () => {
      const [accountA] = accounts
      const [chip] = chipData
      await chipTreasury.pause({ from: owner })
      const illegalClaimChip = chipTreasury.claimChip(chip.id, chip.password, {
        from: accountA
      })
      assert.isRejected(illegalClaimChip)
    })
  })

  describe('#withdrawFunds', async () => {
    it('should allow owner to withdraw ether from the treasury', async () => {
      const ownerWalletBalance = new BigNumber(await eth.getBalance(owner))
      const chipTreasuryBalance = new BigNumber(
        await eth.getBalance(chipTreasury.address)
      )
      const { logs: [withdrawal] } = await chipTreasury.withdrawFunds(
        unit.unitMap.ether,
        { from: owner }
      )
      assert.equal(withdrawal.event, 'Withdrawal')

      const newOwnerWalletBalance = new BigNumber(await eth.getBalance(owner))
      const newChipTreasuryBalance = new BigNumber(
        await eth.getBalance(chipTreasury.address)
      )
      assert.equal(chipTreasuryBalance.toNumber(), unit.unitMap.ether)
      assert.equal(newChipTreasuryBalance.toNumber(), 0)

      const receivedEther = Number(
        unit.fromWei(
          newOwnerWalletBalance.minus(ownerWalletBalance).toNumber(),
          'ether'
        )
      )
      assert.closeTo(ether, receivedEther, centiEther)
    })
  })
})
