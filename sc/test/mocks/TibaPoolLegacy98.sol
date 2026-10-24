// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TibaPool} from "../../src/TibaPool.sol";

/// @dev The pool as first deployed, advancing 98%. Used to check a later rate change.
contract TibaPoolLegacy98 is TibaPool {
    function _advanceBps() internal pure override returns (uint256) {
        return 9800;
    }
}
