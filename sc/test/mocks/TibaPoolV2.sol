// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TibaPool} from "../../src/TibaPool.sol";

/// @notice Upgrade test target. Shows the V2 pattern: a `reinitializer(2)` and (optionally) a new
///         ERC-7201 namespace for any new state, never touching the V1 struct layout.
/// @custom:oz-upgrades-from src/TibaPool.sol:TibaPool
contract TibaPoolV2 is TibaPool {
    /// @custom:storage-location erc7201:tiba.storage.TibaPoolV2
    struct V2Storage {
        uint256 upgradedAt;
    }

    // keccak256(abi.encode(uint256(keccak256("tiba.storage.TibaPoolV2")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant V2_STORAGE = 0xb5b49ae22352c9850355be1fa4b6ecbfc240003b3b04d39593f13e58a047bb00;

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
