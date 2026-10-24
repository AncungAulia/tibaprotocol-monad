// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {Upgrades, Options} from "openzeppelin-foundry-upgrades/Upgrades.sol";

/// @notice Upgrades one proxy to a new implementation, validated against the current one.
///
///   forge clean
///   TARGET=ShipmentManager NEW_IMPL=ShipmentManagerV2.sol forge script script/Upgrade.s.sol --rpc-url monad --broadcast
///
/// Env:
///   PRIVATE_KEY  proxy owner
///   TARGET       "ShipmentManager" or "TibaPool"
///   NEW_IMPL     new contract file/name, e.g. "ShipmentManagerV2.sol". It must carry
///                `@custom:oz-upgrades-from <Old>` or REFERENCE must be set.
///   REFERENCE    optional reference contract, e.g. "ShipmentManager.sol", or
///                "build-info-v1:TibaPool" together with REFERENCE_BUILD_INFO_DIR
///   REFERENCE_BUILD_INFO_DIR  optional, e.g. "previous-builds/build-info-v1": a copy of
///                `out/build-info` from the deployed version, for upgrading a contract in place
///   CALL_DATA    optional hex calldata executed with the upgrade (e.g. initializeV2())
/// Reads the proxy from deployments/<chainId>.json and records the new implementation there.
contract Upgrade is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        string memory target = vm.envString("TARGET");
        string memory newImpl = vm.envString("NEW_IMPL");
        bytes memory data = vm.envOr("CALL_DATA", bytes(""));

        string memory key;
        if (_eq(target, "ShipmentManager")) key = "shipmentManager";
        else if (_eq(target, "TibaPool")) key = "tibaPool";
        else revert("TARGET must be ShipmentManager or TibaPool");

        string memory path = string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json");
        address proxy = vm.parseJsonAddress(vm.readFile(path), string.concat(".", key));

        Options memory opts;
        opts.referenceContract = vm.envOr("REFERENCE", string(""));
        opts.referenceBuildInfoDir = vm.envOr("REFERENCE_BUILD_INFO_DIR", string(""));

        vm.startBroadcast(pk);
        Upgrades.upgradeProxy(proxy, newImpl, data, opts);
        vm.stopBroadcast();

        address impl = Upgrades.getImplementationAddress(proxy);
        vm.writeJson(string.concat('"', vm.toString(impl), '"'), path, string.concat(".", key, "Impl"));
        console.log("proxy          ", proxy);
        console.log("implementation ", impl);
    }

    function _eq(string memory a, string memory b) private pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
