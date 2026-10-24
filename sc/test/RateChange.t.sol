// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {UnsafeUpgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ShipmentManager} from "../src/ShipmentManager.sol";
import {TibaPool} from "../src/TibaPool.sol";
import {TibaPoolLegacy98} from "./mocks/TibaPoolLegacy98.sol";

/// @dev Upgrading from the 98% pool to the 97.5% pool must not reprice shipments already financed:
///      repayment uses the advance recorded at financing time. Only new advances use the new rate.
contract RateChangeTest is Test {
    MockUSDC internal usdc;
    ShipmentManager internal sm;
    TibaPool internal pool;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal payer = makeAddr("payer");
    address internal carrier = makeAddr("carrier");
    address internal consignee = makeAddr("consignee");
    address internal investor = makeAddr("investor");

    function setUp() public {
        usdc = new MockUSDC(admin);
        sm = ShipmentManager(
            UnsafeUpgrades.deployUUPSProxy(
                address(new ShipmentManager()), abi.encodeCall(ShipmentManager.initialize, (admin))
            )
        );
        pool = TibaPool(
            UnsafeUpgrades.deployUUPSProxy(
                address(new TibaPoolLegacy98()),
                abi.encodeCall(TibaPool.initialize, (admin, address(usdc), address(sm), treasury))
            )
        );
        vm.startPrank(admin);
        sm.setPool(address(pool));
        pool.setCreditLimit(payer, 3_000e6);
        usdc.mint(investor, 1_000e6);
        usdc.mint(payer, 1_000e6);
        vm.stopPrank();
        vm.startPrank(investor);
        usdc.approve(address(pool), type(uint256).max);
        pool.deposit(1_000e6);
        vm.stopPrank();
        vm.prank(payer);
        usdc.approve(address(pool), type(uint256).max);
    }

    function _financed() internal returns (uint256 id) {
        vm.prank(payer);
        id = sm.createShipment(carrier, consignee, 300e6, uint64(block.timestamp + 1 days));
        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(consignee);
        sm.confirmDelivery(id, true, 10);
        vm.prank(carrier);
        pool.requestAdvance(id);
    }

    function test_oldAdvanceIsRepaidAtItsRecordedAmount() public {
        uint256 oldId = _financed();
        assertEq(pool.advanced(oldId), 294e6);

        address impl = address(new TibaPool());
        UnsafeUpgrades.upgradeProxy(address(pool), impl, "", admin);
        assertEq(pool.ADVANCE_BPS(), 9750);
        assertEq(pool.advanced(oldId), 294e6);

        // old shipment: 6.00 spread, split 4.80 pool / 1.20 treasury
        vm.prank(payer);
        pool.repay(oldId);
        assertEq(usdc.balanceOf(treasury), 1.2e6);
        assertEq(pool.totalFeesToPool(), 4.8e6);
        assertEq(pool.deployed(), 0);

        // new shipment after the upgrade: 97.5%
        uint256 newId = _financed();
        assertEq(pool.advanced(newId), 292.5e6);
        vm.prank(payer);
        pool.repay(newId);
        assertEq(usdc.balanceOf(treasury), 1.2e6 + 1.5e6);
        assertEq(pool.totalFeesToPool(), 4.8e6 + 6e6);
        assertEq(usdc.balanceOf(address(pool)), pool.totalAssets());
    }
}
