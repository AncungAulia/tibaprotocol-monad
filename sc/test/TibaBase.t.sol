// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {UnsafeUpgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ShipmentManager} from "../src/ShipmentManager.sol";
import {TibaPool} from "../src/TibaPool.sol";
import {Status} from "../src/interfaces/ITiba.sol";

/// @dev Shared fixture. Uses UnsafeUpgrades (no ffi validation) so every test's setUp stays fast;
///      Upgrade.t.sol exercises the validated `Upgrades` path.
abstract contract TibaBase is Test {
    MockUSDC internal usdc;
    ShipmentManager internal sm;
    TibaPool internal pool;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal payer = makeAddr("payer"); // PT Maju
    address internal carrier = makeAddr("carrier"); // Pak Budi
    address internal consignee = makeAddr("consignee"); // Dewi
    address internal investor = makeAddr("investor"); // Rina
    address internal stranger = makeAddr("stranger");

    uint128 internal constant FEE = 300e6;
    uint256 internal constant LIMIT = 3_000e6;
    uint256 internal constant LIQUIDITY = 10_000e6;

    function setUp() public virtual {
        usdc = new MockUSDC(admin);
        address smProxy = UnsafeUpgrades.deployUUPSProxy(
            address(new ShipmentManager()), abi.encodeCall(ShipmentManager.initialize, (admin))
        );
        sm = ShipmentManager(smProxy);
        address poolProxy = UnsafeUpgrades.deployUUPSProxy(
            address(new TibaPool()), abi.encodeCall(TibaPool.initialize, (admin, address(usdc), smProxy, treasury))
        );
        pool = TibaPool(poolProxy);

        vm.startPrank(admin);
        sm.setPool(poolProxy);
        pool.setCreditLimit(payer, LIMIT);
        usdc.mint(investor, LIQUIDITY);
        usdc.mint(payer, 10_000e6);
        vm.stopPrank();

        vm.prank(payer);
        usdc.approve(address(pool), type(uint256).max);
        vm.prank(investor);
        usdc.approve(address(pool), type(uint256).max);
    }

    // ---------------------------------------------------------------- helpers

    function _deposit(address who, uint256 amount) internal returns (uint256) {
        vm.prank(who);
        return pool.deposit(amount);
    }

    function _create(uint128 amount, uint64 dueIn) internal returns (uint256 id) {
        vm.prank(payer);
        id = sm.createShipment(carrier, consignee, amount, uint64(block.timestamp) + dueIn);
    }

    function _delivered(uint128 amount) internal returns (uint256 id) {
        id = _create(amount, 7 days);
        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(consignee);
        sm.confirmDelivery(id, true, 100);
    }

    function _financed(uint128 amount) internal returns (uint256 id) {
        id = _delivered(amount);
        vm.prank(carrier);
        pool.requestAdvance(id);
    }

    function _status(uint256 id) internal view returns (Status) {
        return sm.getShipment(id).status;
    }
}
