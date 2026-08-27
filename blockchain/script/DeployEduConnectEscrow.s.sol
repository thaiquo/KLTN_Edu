// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {EduConnectEscrow} from "../src/EduConnectEscrow.sol";
import {EduTestUSDC} from "../src/mocks/EduTestUSDC.sol";

contract DeployEduConnectEscrow is Script {
    uint256 private constant ANVIL_CHAIN_ID = 31_337;
    uint256 private constant SEPOLIA_CHAIN_ID = 11_155_111;
    address private constant SEPOLIA_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;

    error UnsupportedChain(uint256 chainId);
    error InvalidDeploymentAddress();

    function run() external returns (EduConnectEscrow escrow) {
        address tokenAddress;
        address adminWallet;
        address platformWallet;

        if (block.chainid == ANVIL_CHAIN_ID) {
            adminWallet = tx.origin;
            platformWallet = tx.origin;
            if (adminWallet == address(0)) revert InvalidDeploymentAddress();

            vm.startBroadcast();
            EduTestUSDC token = new EduTestUSDC();
            tokenAddress = address(token);
            escrow = new EduConnectEscrow(tokenAddress, platformWallet, adminWallet);
            vm.stopBroadcast();
        } else if (block.chainid == SEPOLIA_CHAIN_ID) {
            adminWallet = vm.envAddress("ADMIN_WALLET");
            platformWallet = vm.envAddress("PLATFORM_WALLET");
            if (adminWallet == address(0) || platformWallet == address(0)) {
                revert InvalidDeploymentAddress();
            }
            tokenAddress = SEPOLIA_USDC;

            vm.startBroadcast();
            escrow = new EduConnectEscrow(tokenAddress, platformWallet, adminWallet);
            vm.stopBroadcast();
        } else {
            revert UnsupportedChain(block.chainid);
        }

        console2.log("Chain ID", block.chainid);
        console2.log("USDC token", tokenAddress);
        console2.log("EduConnectEscrow", address(escrow));
        console2.log("Admin/operator/arbitrator", adminWallet);
        console2.log("Platform wallet", platformWallet);
    }
}
