// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ShipmentManager} from "../src/ShipmentManager.sol";
import {TibaPool} from "../src/TibaPool.sol";
import {Status, Shipment} from "../src/interfaces/ITiba.sol";
import {ShipmentManagerV2} from "./mocks/ShipmentManagerV2.sol";
import {TibaPoolV2} from "./mocks/TibaPoolV2.sol";

/// @dev Uses the validated `Upgrades` library (runs @openzeppelin/upgrades-core via ffi/npx).
///      Run `forge clean && forge test` if validation complains about stale build info.
contract UpgradeTest is Test {
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
            Upgrades.deployUUPSProxy("ShipmentManager.sol", abi.encodeCall(ShipmentManager.initialize, (admin)))
        );
        pool = TibaPool(
            Upgrades.deployUUPSProxy(
                "TibaPool.sol", abi.encodeCall(TibaPool.initialize, (admin, address(usdc), address(sm), treasury))
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

        // one financed shipment so there is meaningful state to preserve
        vm.prank(payer);
        uint256 id = sm.createShipment(carrier, consignee, 300e6, uint64(block.timestamp + 1 days));
        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(consignee);
        sm.confirmDelivery(id, true, 10);
        vm.prank(carrier);
        pool.requestAdvance(id);
    }

    function test_upgradeBoth_preservesState() public {
        address smImplBefore = Upgrades.getImplementationAddress(address(sm));
        address poolImplBefore = Upgrades.getImplementationAddress(address(pool));

        vm.startPrank(admin);
        Upgrades.upgradeProxy(address(sm), "ShipmentManagerV2.sol", abi.encodeCall(ShipmentManagerV2.initializeV2, ()));
        Upgrades.upgradeProxy(address(pool), "TibaPoolV2.sol", abi.encodeCall(TibaPoolV2.initializeV2, ()));
        vm.stopPrank();

        assertTrue(Upgrades.getImplementationAddress(address(sm)) != smImplBefore);
        assertTrue(Upgrades.getImplementationAddress(address(pool)) != poolImplBefore);
        assertEq(ShipmentManagerV2(address(sm)).version(), "2");
        assertEq(TibaPoolV2(address(pool)).version(), "2");
        assertEq(ShipmentManagerV2(address(sm)).upgradedAt(), block.timestamp);
        assertEq(TibaPoolV2(address(pool)).upgradedAt(), block.timestamp);
        vm.expectRevert();
        ShipmentManagerV2(address(sm)).initializeV2();

        // ShipmentManager state
        Shipment memory s = sm.getShipment(1);
        assertEq(s.payer, payer);
        assertEq(s.amount, 300e6);
        assertEq(uint8(s.status), uint8(Status.FINANCED));
        assertEq(sm.nextId(), 2);
        assertEq(sm.pool(), address(pool));
        assertEq(sm.owner(), admin);

        // TibaPool state
        assertEq(pool.owner(), admin);
        assertEq(pool.creditLimit(payer), 3_000e6);
        assertEq(pool.outstanding(payer), 300e6);
        assertEq(pool.available(), 706e6);
        assertEq(pool.deployed(), 294e6);
        assertEq(pool.sharesOf(investor), 1_000e6);
        assertEq(pool.treasury(), treasury);

        // and it keeps working after the upgrade
        vm.startPrank(payer);
        usdc.approve(address(pool), 300e6);
        pool.repay(1);
        vm.stopPrank();
        assertEq(uint8(sm.getShipment(1).status), uint8(Status.REPAID));
        assertEq(pool.totalAssets(), 1_004.8e6);
    }

    function test_upgrade_onlyOwner() public {
        address v2 = address(new ShipmentManagerV2());
        vm.prank(payer);
        vm.expectRevert();
        sm.upgradeToAndCall(v2, "");
    }

    function test_cannotReinitialize() public {
        vm.expectRevert();
        sm.initialize(payer);
        vm.expectRevert();
        pool.initialize(payer, address(usdc), address(sm), treasury);
    }
}
