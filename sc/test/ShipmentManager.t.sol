// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TibaBase} from "./TibaBase.t.sol";
import {ShipmentManager} from "../src/ShipmentManager.sol";
import {Status, Shipment} from "../src/interfaces/ITiba.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract ShipmentManagerTest is TibaBase {
    // ---------------------------------------------------------------- invariant 1: credit limit + overdue

    function test_create_byApprovedPayer() public {
        uint64 due = uint64(block.timestamp + 7 days);
        vm.expectEmit(address(sm));
        emit ShipmentManager.ShipmentCreated(1, payer, carrier, consignee, FEE, due);
        vm.prank(payer);
        uint256 id = sm.createShipment(carrier, consignee, FEE, due);

        assertEq(id, 1);
        assertEq(sm.nextId(), 2);
        Shipment memory s = sm.getShipment(id);
        assertEq(s.payer, payer);
        assertEq(s.carrier, carrier);
        assertEq(s.consignee, consignee);
        assertEq(s.amount, FEE);
        assertEq(s.dueDate, due);
        assertEq(uint8(s.status), uint8(Status.APPROVED));

        (address p, address c, address cons, uint128 amt, uint64 d,,, Status st) = sm.shipments(id);
        assertEq(p, payer);
        assertEq(c, carrier);
        assertEq(cons, consignee);
        assertEq(amt, FEE);
        assertEq(d, due);
        assertEq(uint8(st), uint8(Status.APPROVED));
    }

    function test_create_revertsWithoutCreditLimit() public {
        vm.prank(stranger);
        vm.expectRevert(ShipmentManager.NotApprovedPayer.selector);
        sm.createShipment(carrier, consignee, FEE, uint64(block.timestamp + 1 days));
    }

    function test_create_revertsAfterLimitRevoked() public {
        vm.prank(admin);
        pool.setCreditLimit(payer, 0);
        vm.prank(payer);
        vm.expectRevert(ShipmentManager.NotApprovedPayer.selector);
        sm.createShipment(carrier, consignee, FEE, uint64(block.timestamp + 1 days));
    }

    function test_create_revertsAboveCreditLimit() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.CreditLimitExceeded.selector, LIMIT + 1, 0, LIMIT));
        sm.createShipment(carrier, consignee, 3_000e6 + 1, uint64(block.timestamp + 1 days));
    }

    function test_create_countsOutstanding() public {
        _deposit(investor, LIQUIDITY);
        _financed(2_000e6);
        assertEq(pool.outstanding(payer), 2_000e6);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.CreditLimitExceeded.selector, 1_001e6, 2_000e6, LIMIT));
        sm.createShipment(carrier, consignee, 1_001e6, uint64(block.timestamp + 1 days));
        // exactly at the limit is fine
        _create(1_000e6, 1 days);
    }

    function test_create_blockedByOverdue_thenUnblockedByRepay() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _financed(FEE); // due in 7 days
        Shipment memory s = sm.getShipment(id);

        // at dueDate + GRACE: not yet overdue
        vm.warp(uint256(s.dueDate) + pool.GRACE());
        assertFalse(pool.isOverdue(id));
        _create(FEE, 1 days);

        // one second later: overdue, new shipments blocked
        vm.warp(uint256(s.dueDate) + pool.GRACE() + 1);
        assertTrue(pool.isOverdue(id));
        assertTrue(pool.hasOverdue(payer));
        vm.prank(payer);
        vm.expectRevert(ShipmentManager.PayerHasOverdue.selector);
        sm.createShipment(carrier, consignee, FEE, uint64(block.timestamp + 1 days));

        // repaying clears the block
        vm.prank(payer);
        pool.repay(id);
        assertFalse(pool.hasOverdue(payer));
        assertFalse(pool.isOverdue(id));
        _create(FEE, 1 days);
    }

    function test_create_inputValidation() public {
        vm.startPrank(payer);
        vm.expectRevert(ShipmentManager.ZeroAddress.selector);
        sm.createShipment(address(0), consignee, FEE, uint64(block.timestamp + 1));
        vm.expectRevert(ShipmentManager.ZeroAddress.selector);
        sm.createShipment(carrier, address(0), FEE, uint64(block.timestamp + 1));
        vm.expectRevert(ShipmentManager.InvalidAmount.selector);
        sm.createShipment(carrier, consignee, 0, uint64(block.timestamp + 1));
        vm.expectRevert(ShipmentManager.InvalidDueDate.selector);
        sm.createShipment(carrier, consignee, FEE, uint64(block.timestamp));
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- invariant 2: fee and due date immutable

    function test_feeAndDueDateNeverChange() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _create(FEE, 7 days);
        Shipment memory before = sm.getShipment(id);

        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(consignee);
        sm.confirmDelivery(id, true, 42);
        vm.prank(carrier);
        pool.requestAdvance(id);
        vm.prank(payer);
        pool.repay(id);

        Shipment memory afterAll = sm.getShipment(id);
        assertEq(afterAll.amount, before.amount);
        assertEq(afterAll.dueDate, before.dueDate);
        assertEq(afterAll.payer, before.payer);
        assertEq(afterAll.carrier, before.carrier);
        assertEq(afterAll.consignee, before.consignee);
        assertEq(afterAll.receivedQty, 42);
    }

    // ---------------------------------------------------------------- invariant 3: role checks

    function test_pickup_onlyCarrier() public {
        uint256 id = _create(FEE, 1 days);
        vm.prank(payer);
        vm.expectRevert(ShipmentManager.NotCarrier.selector);
        sm.confirmPickup(id);
        vm.prank(consignee);
        vm.expectRevert(ShipmentManager.NotCarrier.selector);
        sm.confirmPickup(id);
    }

    function test_delivery_onlyConsignee() public {
        uint256 id = _create(FEE, 1 days);
        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(carrier);
        vm.expectRevert(ShipmentManager.NotConsignee.selector);
        sm.confirmDelivery(id, true, 1);
        vm.prank(payer);
        vm.expectRevert(ShipmentManager.NotConsignee.selector);
        sm.confirmDelivery(id, false, 1);
    }

    function test_poolHooks_onlyPool() public {
        uint256 id = _delivered(FEE);
        vm.prank(admin);
        vm.expectRevert(ShipmentManager.OnlyPool.selector);
        sm.markFinanced(id, 1);
        vm.prank(payer);
        vm.expectRevert(ShipmentManager.OnlyPool.selector);
        sm.markRepaid(id, false);
    }

    // ---------------------------------------------------------------- invariant 4: status only moves forward

    function test_status_forwardOnly() public {
        uint256 id = _create(FEE, 1 days);

        // cannot deliver before pickup
        vm.prank(consignee);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.InvalidStatus.selector, Status.APPROVED));
        sm.confirmDelivery(id, true, 1);

        vm.prank(carrier);
        sm.confirmPickup(id);
        assertEq(uint8(_status(id)), uint8(Status.IN_TRANSIT));

        // cannot pick up twice
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.InvalidStatus.selector, Status.IN_TRANSIT));
        sm.confirmPickup(id);

        vm.prank(consignee);
        sm.confirmDelivery(id, true, 1);
        assertEq(uint8(_status(id)), uint8(Status.DELIVERED));

        // cannot deliver / dispute again or go back
        vm.prank(consignee);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.InvalidStatus.selector, Status.DELIVERED));
        sm.confirmDelivery(id, false, 1);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.InvalidStatus.selector, Status.DELIVERED));
        sm.confirmPickup(id);
    }

    function test_disputed_isTerminal() public {
        uint256 id = _create(FEE, 1 days);
        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(consignee);
        sm.confirmDelivery(id, false, 7);
        Shipment memory s = sm.getShipment(id);
        assertEq(uint8(s.status), uint8(Status.DISPUTED));
        assertEq(s.receivedQty, 7);
        assertEq(s.deliveredAt, 0);

        vm.prank(consignee);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.InvalidStatus.selector, Status.DISPUTED));
        sm.confirmDelivery(id, true, 7);
    }

    function test_unknownShipment_cannotMove() public {
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(ShipmentManager.InvalidStatus.selector, Status.NONE));
        sm.confirmPickup(999);
    }

    // ---------------------------------------------------------------- invariant 10: every transition emits

    function test_events_everyTransition() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _create(FEE, 1 days);

        vm.expectEmit(address(sm));
        emit ShipmentManager.PickedUp(id);
        vm.prank(carrier);
        sm.confirmPickup(id);

        vm.expectEmit(address(sm));
        emit ShipmentManager.Delivered(id, 50);
        vm.prank(consignee);
        sm.confirmDelivery(id, true, 50);

        vm.expectEmit(address(sm));
        emit ShipmentManager.Financed(id, 292.5e6);
        vm.prank(carrier);
        pool.requestAdvance(id);

        vm.expectEmit(address(sm));
        emit ShipmentManager.Repaid(id, false);
        vm.prank(payer);
        pool.repay(id);

        uint256 id2 = _create(FEE, 1 days);
        vm.prank(carrier);
        sm.confirmPickup(id2);
        vm.expectEmit(address(sm));
        emit ShipmentManager.Disputed(id2, 3);
        vm.prank(consignee);
        sm.confirmDelivery(id2, false, 3);
    }

    // ---------------------------------------------------------------- admin

    function test_setPool_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        sm.setPool(stranger);
    }

    function test_create_revertsWhenPoolNotSet() public {
        ShipmentManager fresh = ShipmentManager(
            address(
                new ERC1967Proxy(address(new ShipmentManager()), abi.encodeCall(ShipmentManager.initialize, (admin)))
            )
        );
        vm.prank(payer);
        vm.expectRevert(ShipmentManager.PoolNotSet.selector);
        fresh.createShipment(carrier, consignee, FEE, uint64(block.timestamp + 1));
    }

    function test_implementation_cannotBeInitialized() public {
        ShipmentManager impl = new ShipmentManager();
        vm.expectRevert();
        impl.initialize(admin);
    }
}

