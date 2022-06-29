// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import 'algebra-periphery/contracts/libraries/TransferHelper.sol';
import './interfaces/IFarmingCenterVault.sol';

contract FarmingCenterVault is IFarmingCenterVault {
    address public farmingCenter;
    address public immutable owner;
    // tokenId => IncentiveId => TokenAmount
    mapping(uint256 => mapping(bytes32 => uint256)) public override balances;

    constructor() {
        owner = msg.sender;
    }

    function setFarming(address _farmingCenter) external override {
        require(msg.sender == owner, 'onlyOwner');
        farmingCenter = _farmingCenter;
    }

    function claimTokens(
        address multiplierToken,
        address to,
        uint256 tokenId,
        bytes32 incentiveId
    ) external override {
        require(msg.sender == farmingCenter, 'onlyFarming');

        uint256 balance = balances[tokenId][incentiveId];
        if (balance > 0) {
            TransferHelper.safeTransfer(multiplierToken, to, balance);
        }
    }
}
