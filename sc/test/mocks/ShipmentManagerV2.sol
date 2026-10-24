// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ShipmentManager} from "../../src/ShipmentManager.sol";

/// @notice Upgrade test target. Shows the V2 pattern: a `reinitializer(2)` and (optionally) a new
///         ERC-7201 namespace for any new state, never touching the V1 struct layout.
/// @custom:oz-upgrades-from src/ShipmentManager.sol:ShipmentManager
contract ShipmentManagerV2 is ShipmentManager {
    /// @custom:storage-location erc7201:tiba.storage.ShipmentManagerV2
    struct V2Storage {
        uint256 upgradedAt;
    }

    // keccak256(abi.encode(uint256(keccak256("tiba.storage.ShipmentManagerV2")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant V2_STORAGE = 0x47e0bd15d81b2b1de6f9080d891f0f70f6e534355fa3bc32db0ef13075a00000;

    function initializeV2() external reinitializer(2) {
        _v2().upgradedAt = block.timestamp;
    }

    function upgradedAt() external view returns (uint256) {
        return _v2().upgradedAt;
    }

    function _v2() private pure returns (V2Storage storage $) {
        assembly {
            $.slot := V2_STORAGE
        }
    }

    function version() external pure returns (string memory) {
        return "2";
    }
}
