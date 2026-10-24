// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ShipmentManager} from "../src/ShipmentManager.sol";
import {TibaPool} from "../src/TibaPool.sol";

/// @notice Deploys MockUSDC (unless USDC is set), the ShipmentManager and TibaPool UUPS proxies, wires
///         them, and writes the addresses to deployments/<chainId>.json.
///
///   forge clean && forge script script/Deploy.s.sol --rpc-url monad --broadcast
///
/// Env: PRIVATE_KEY (deployer = owner), TREASURY (default: deployer), USDC (optional existing token).
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        address treasury = vm.envOr("TREASURY", deployer);
        address usdc = vm.envOr("USDC", address(0));

        vm.startBroadcast(pk);

        if (usdc == address(0)) {
            usdc = address(new MockUSDC(deployer));
        }

        address sm =
            Upgrades.deployUUPSProxy("ShipmentManager.sol", abi.encodeCall(ShipmentManager.initialize, (deployer)));
        address pool = Upgrades.deployUUPSProxy(
            "TibaPool.sol", abi.encodeCall(TibaPool.initialize, (deployer, usdc, sm, treasury))
        );
        ShipmentManager(sm).setPool(pool);

        vm.stopBroadcast();

        _write(usdc, sm, pool, deployer, treasury);

        console.log("MockUSDC        ", usdc);
        console.log("ShipmentManager ", sm);
        console.log("TibaPool        ", pool);
        console.log("owner           ", deployer);
        console.log("treasury        ", treasury);
    }

    function _write(address usdc, address sm, address pool, address owner, address treasury) internal {
        string memory k = "deployment";
        vm.serializeUint(k, "chainId", block.chainid);
        vm.serializeUint(k, "deployedAtBlock", block.number);
        vm.serializeAddress(k, "owner", owner);
        vm.serializeAddress(k, "treasury", treasury);
        vm.serializeAddress(k, "mockUsdc", usdc);
        vm.serializeAddress(k, "shipmentManager", sm);
        vm.serializeAddress(k, "shipmentManagerImpl", Upgrades.getImplementationAddress(sm));
        vm.serializeAddress(k, "tibaPool", pool);
        string memory json = vm.serializeAddress(k, "tibaPoolImpl", Upgrades.getImplementationAddress(pool));
        vm.writeJson(json, string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
    }
}
