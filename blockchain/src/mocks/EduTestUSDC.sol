// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Test-only six-decimal token for Forge and Anvil.
/// @dev This mock must never be deployed on Ethereum Sepolia.
contract EduTestUSDC is ERC20 {
    constructor() ERC20("Edu Test USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

