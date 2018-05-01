pragma solidity 0.4.23;
import "zeppelin-solidity/contracts/math/SafeMath.sol";
import "zeppelin-solidity/contracts/lifecycle/Pausable.sol";
import "zeppelin-solidity/contracts/token/ERC20/StandardToken.sol";


// TODO: Explore possibility of retiring unclaimed chips
contract ChipTreasury is Pausable {
  using SafeMath for uint256;

  mapping(uint => Chip) public chips;
  uint                  public numChipsMinted;
  uint                  public numChipsClaimed;

  struct Chip {
    bytes32 hash;
    bool claimed;
  }

  event Deposit(address indexed sender, uint value);
  event Withdrawal(address indexed to, uint value);
  event TokenWithdrawal(address indexed to, address indexed token, uint value);

  event ChipMinted(uint indexed chipId);
  event ChipClaimAttempt(address indexed sender, uint indexed chipId);
  event ChipClaimSuccess(address indexed sender, uint indexed chipId);

  constructor () public {
    paused = true;
  }

  function () public payable {
    if (msg.value > 0) emit Deposit(msg.sender, msg.value);
  }

  function claimChip (uint chipId, string password) public whenNotPaused {
    emit ChipClaimAttempt(msg.sender, chipId);
    // 1. Conditions
    require(isClaimed(chipId) == false);       // chip is unclaimed
    require(isChipPassword(chipId, password)); // sender has chip password

    // 2. Effects
    uint chipValue = getChipValue();           // get chip value
    numChipsClaimed = numChipsClaimed.add(1);  // increase claimed count
    chips[chipId].claimed = true;              // mark chip as claimed

    // 3. Interaction
    msg.sender.transfer(chipValue);            // send ether to the sender
    emit ChipClaimSuccess(msg.sender, chipId);
  }

  // NOTE: You must prefix hashes with '0x'
  function mintChip (bytes32 hash) public onlyOwner {
    chips[numChipsMinted] = Chip(hash, false);
    emit ChipMinted(numChipsMinted);
    numChipsMinted = numChipsMinted.add(1);
  }

  function withdrawFunds (uint value) public onlyOwner {
    owner.transfer(value);
    emit Withdrawal(owner, value);
  }

  function withdrawTokens (address token, uint value) public onlyOwner {
    StandardToken(token).transfer(owner, value);
    emit TokenWithdrawal(owner, token, value);
  }

  function isClaimed (uint chipId) public view returns(bool) {
    return chips[chipId].claimed;
  }

  function getNumChips () public view returns(uint) {
    return numChipsMinted.sub(numChipsClaimed);
  }

  function getChipIds (bool isChipClaimed) public view returns(uint[]) {
    uint[] memory chipIdsTemp = new uint[](numChipsMinted);
    uint count = 0;
    uint i;

    // filter chips by isChipClaimed status
    for (i = 0; i < numChipsMinted; i++) {
      if (isChipClaimed == chips[i].claimed) {
        chipIdsTemp[count] = i;
        count += 1;
      }
    }

    // return array of filtered chip ids
    uint[] memory _chipIds = new uint[](count);
    for (i = 0; i < count; i++) _chipIds[i] = chipIdsTemp[i];
    return _chipIds;
  }

  function getChipValue () public view returns(uint) {
    uint numChips = getNumChips();
    if (numChips > 0) return address(this).balance.div(numChips);
    return 0;
  }

  function isChipPassword (uint chipId, string password) internal view returns(bool) {
    return chips[chipId].hash == keccak256(password);
  }

}
