// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TibaBase} from "./TibaBase.t.sol";
import {TibaPool} from "../src/TibaPool.sol";
import {Status, Shipment} from "../src/interfaces/ITiba.sol";

contract TibaPoolTest is TibaBase {
    // ---------------------------------------------------------------- the spec's numbers example

    function test_numbersExample_300_294_4p80_1p20() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _delivered(FEE);

        vm.expectEmit(address(pool));
        emit TibaPool.AdvancePaid(id, carrier, payer, 300e6, 294e6);
        vm.prank(carrier);
        uint256 advance = pool.requestAdvance(id);

        assertEq(advance, 294e6);
        assertEq(usdc.balanceOf(carrier), 294e6);
        assertEq(pool.available(), LIQUIDITY - 294e6);
        assertEq(pool.deployed(), 294e6);
        assertEq(pool.totalAssets(), LIQUIDITY); // lending does not move the share price
        assertEq(pool.outstanding(payer), 300e6);
        assertEq(pool.advanced(id), 294e6);
        assertEq(uint8(_status(id)), uint8(Status.FINANCED));

        uint256 payerBefore = usdc.balanceOf(payer);
        vm.expectEmit(address(pool));
        emit TibaPool.RepaymentReceived(id, payer, payer, 300e6, 4.8e6, 1.2e6, false);
        vm.prank(payer);
        pool.repay(id);

        assertEq(payerBefore - usdc.balanceOf(payer), 300e6);
        assertEq(usdc.balanceOf(treasury), 1.2e6);
        assertEq(pool.totalAssets(), LIQUIDITY + 4.8e6);
        assertEq(pool.available(), LIQUIDITY + 4.8e6);
        assertEq(pool.deployed(), 0);
        assertEq(pool.outstanding(payer), 0);
        assertEq(usdc.balanceOf(address(pool)), LIQUIDITY + 4.8e6);
        assertEq(pool.totalFeesToPool(), 4.8e6);
        assertEq(pool.totalFeesToTreasury(), 1.2e6);
        assertEq(uint8(_status(id)), uint8(Status.REPAID));

        TibaPool.PayerStats memory st = pool.payerStats(payer);
        assertEq(st.repaidCount, 1);
        assertEq(st.lateCount, 0);
        assertEq(st.totalRepaid, 300e6);

        // share value rose: the sole investor can now take out principal + 4.80
        assertApproxEqAbs(pool.maxWithdraw(investor), LIQUIDITY + 4.8e6, 1); // virtual-share rounding
        uint256 allShares = pool.sharesOf(investor);
        vm.prank(investor);
        uint256 out = pool.withdraw(allShares);
        assertApproxEqAbs(out, LIQUIDITY + 4.8e6, 1);
    }

    function test_repay_late_isRecorded() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _financed(FEE);
        Shipment memory s = sm.getShipment(id);
        vm.warp(uint256(s.dueDate) + pool.GRACE() + 1);
        vm.prank(payer);
        pool.repay(id);
        TibaPool.PayerStats memory st = pool.payerStats(payer);
        assertEq(st.repaidCount, 1);
        assertEq(st.lateCount, 1);
    }

    // ---------------------------------------------------------------- unfinanced repay goes to the carrier

    function test_repay_unfinanced_paysCarrierDirectly() public {
        uint256 id = _delivered(FEE);
        uint256 poolBefore = usdc.balanceOf(address(pool));

        vm.expectEmit(address(pool));
        emit TibaPool.PaidToCarrier(id, carrier, FEE, false);
        vm.prank(payer);
        pool.repay(id);

        assertEq(usdc.balanceOf(carrier), FEE);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(usdc.balanceOf(address(pool)), poolBefore);
        assertEq(pool.outstanding(payer), 0);
        assertEq(uint8(_status(id)), uint8(Status.REPAID));

        // and it can no longer be financed
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotDelivered.selector, Status.REPAID));
        pool.requestAdvance(id);
    }

    function test_repay_byThirdParty() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _financed(FEE);
        vm.prank(admin);
        usdc.mint(stranger, FEE);
        vm.startPrank(stranger);
        usdc.approve(address(pool), FEE);
        pool.repay(id);
        vm.stopPrank();
        assertEq(pool.outstanding(payer), 0);
        assertEq(pool.payerStats(payer).repaidCount, 1);
    }

    // ---------------------------------------------------------------- invariant 5: no financing before DELIVERED / when DISPUTED

    function test_advance_revertsBeforeDelivered() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _create(FEE, 1 days);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotDelivered.selector, Status.APPROVED));
        pool.requestAdvance(id);

        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotDelivered.selector, Status.IN_TRANSIT));
        pool.requestAdvance(id);
    }

    function test_advance_revertsWhenDisputed() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _create(FEE, 1 days);
        vm.prank(carrier);
        sm.confirmPickup(id);
        vm.prank(consignee);
        sm.confirmDelivery(id, false, 0);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotDelivered.selector, Status.DISPUTED));
        pool.requestAdvance(id);
    }

    function test_advance_onlyCarrier() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _delivered(FEE);
        vm.prank(payer);
        vm.expectRevert(TibaPool.NotCarrier.selector);
        pool.requestAdvance(id);
    }

    function test_advance_revertsWithoutLiquidity() public {
        uint256 id = _delivered(FEE);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.InsufficientLiquidity.selector, 294e6, 0));
        pool.requestAdvance(id);
    }

    // ---------------------------------------------------------------- invariant 6: financed only once

    function test_advance_onlyOnce() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _financed(FEE);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotDelivered.selector, Status.FINANCED));
        pool.requestAdvance(id);
        assertEq(usdc.balanceOf(carrier), 294e6);
    }

    // ---------------------------------------------------------------- invariant 7: outstanding <= credit limit

    function test_advance_respectsCreditLimit_whenLimitLowered() public {
        _deposit(investor, LIQUIDITY);
        _financed(2_000e6);
        uint256 id = _delivered(1_000e6); // created while 1,000 headroom existed
        vm.prank(admin);
        pool.setCreditLimit(payer, 2_500e6);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.CreditLimitExceeded.selector, 1_000e6, 2_000e6, 2_500e6));
        pool.requestAdvance(id);
    }

    function test_advance_respectsCreditLimit_withManyApproved() public {
        _deposit(investor, LIQUIDITY);
        // Several shipments approved while outstanding is still 0 (outstanding counts financed only).
        uint256 a = _delivered(2_000e6);
        uint256 b = _delivered(2_000e6);
        vm.prank(carrier);
        pool.requestAdvance(a);
        vm.prank(carrier);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.CreditLimitExceeded.selector, 2_000e6, 2_000e6, LIMIT));
        pool.requestAdvance(b);
        assertLe(pool.outstanding(payer), pool.creditLimit(payer));
    }

    // ---------------------------------------------------------------- invariant 8: no double repay

    function test_repay_onlyOnce_financed() public {
        _deposit(investor, LIQUIDITY);
        uint256 id = _financed(FEE);
        vm.prank(payer);
        pool.repay(id);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotRepayable.selector, Status.REPAID));
        pool.repay(id);
    }

    function test_repay_onlyOnce_unfinanced() public {
        uint256 id = _delivered(FEE);
        vm.prank(payer);
        pool.repay(id);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotRepayable.selector, Status.REPAID));
        pool.repay(id);
    }

    function test_repay_revertsBeforeDelivered() public {
        uint256 id = _create(FEE, 1 days);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.NotRepayable.selector, Status.APPROVED));
        pool.repay(id);
    }

    // ---------------------------------------------------------------- invariant 9: withdraw <= available()

    function test_withdraw_limitedByAvailable() public {
        _deposit(investor, 1_000e6);
        _financed(FEE); // 294 out
        assertEq(pool.available(), 706e6);
        assertEq(pool.maxWithdraw(investor), 706e6);

        uint256 shares = pool.sharesOf(investor);
        vm.prank(investor);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.InsufficientLiquidity.selector, 1_000e6, 706e6));
        pool.withdraw(shares);

        uint256 maxShares = pool.maxRedeem(investor);
        vm.prank(investor);
        uint256 out = pool.withdraw(maxShares);
        assertLe(out, 706e6);
        assertApproxEqAbs(out, 706e6, 1);
        assertLe(pool.available(), 1);
    }

    function test_withdraw_revertsAboveShares() public {
        _deposit(investor, 1_000e6);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(TibaPool.InsufficientShares.selector, 1, 0));
        pool.withdraw(1);
    }

    // ---------------------------------------------------------------- share math

    function test_shares_lateDepositorDoesNotCaptureEarlierYield() public {
        _deposit(investor, 1_000e6);
        uint256 id = _financed(FEE);
        vm.prank(payer);
        pool.repay(id); // +4.80 to the first investor

        address second = makeAddr("second");
        vm.prank(admin);
        usdc.mint(second, 1_000e6);
        vm.startPrank(second);
        usdc.approve(address(pool), 1_000e6);
        pool.deposit(1_000e6);
        vm.stopPrank();

        assertApproxEqAbs(pool.balanceOfAssets(investor), 1_004.8e6, 1);
        assertApproxEqAbs(pool.balanceOfAssets(second), 1_000e6, 1);
        assertLt(pool.sharesOf(second), pool.sharesOf(investor));
    }

    function test_shares_firstDepositIsOneToOne() public {
        uint256 shares = _deposit(investor, 1_000e6);
        assertEq(shares, 1_000e6);
        assertEq(pool.totalShares(), 1_000e6);
        assertEq(pool.convertToAssets(1_000e6), 1_000e6);
    }

    function test_donation_doesNotMoveSharePrice() public {
        _deposit(investor, 1_000e6);
        vm.prank(admin);
        usdc.mint(address(pool), 5_000e6);
        assertEq(pool.totalAssets(), 1_000e6);
        assertEq(pool.available(), 1_000e6);
    }

    function test_deposit_zeroReverts() public {
        vm.prank(investor);
        vm.expectRevert(TibaPool.ZeroAmount.selector);
        pool.deposit(0);
    }

    // ---------------------------------------------------------------- overdue tracking

    function test_overdueTracking_multipleOpen() public {
        _deposit(investor, LIQUIDITY);
        uint256 a = _financed(500e6);
        uint256 b = _financed(500e6);
        uint256 c = _financed(500e6);
        assertEq(pool.openFinancedOf(payer).length, 3);

        // repay the middle one; swap-and-pop keeps the rest
        vm.prank(payer);
        pool.repay(b);
        uint256[] memory open = pool.openFinancedOf(payer);
        assertEq(open.length, 2);
        assertTrue((open[0] == a && open[1] == c) || (open[0] == c && open[1] == a));

        vm.warp(block.timestamp + 7 days + pool.GRACE() + 1);
        assertTrue(pool.hasOverdue(payer));
        assertTrue(pool.isOverdue(a));
        assertFalse(pool.isOverdue(b)); // repaid

        vm.startPrank(payer);
        pool.repay(c);
        assertTrue(pool.hasOverdue(payer));
        pool.repay(a);
        vm.stopPrank();
        assertFalse(pool.hasOverdue(payer));
        assertEq(pool.openFinancedOf(payer).length, 0);
        assertEq(pool.payerStats(payer).lateCount, 2);
    }

    function test_isOverdue_falseForUnfinanced() public {
        uint256 id = _delivered(FEE);
        vm.warp(block.timestamp + 30 days);
        assertFalse(pool.isOverdue(id));
        assertFalse(pool.hasOverdue(payer));
    }

    // ---------------------------------------------------------------- admin

    function test_admin_onlyOwner() public {
        vm.startPrank(stranger);
        vm.expectRevert();
        pool.setCreditLimit(stranger, 1);
        vm.expectRevert();
        pool.setTreasury(stranger);
        vm.stopPrank();
    }

    function test_setTreasury_redirectsProtocolShare() public {
        address t2 = makeAddr("t2");
        vm.prank(admin);
        pool.setTreasury(t2);
        _deposit(investor, LIQUIDITY);
        uint256 id = _financed(FEE);
        vm.prank(payer);
        pool.repay(id);
        assertEq(usdc.balanceOf(t2), 1.2e6);
        assertEq(usdc.balanceOf(treasury), 0);
    }

    // ---------------------------------------------------------------- fuzz: split always conserves value

    function testFuzz_split(uint128 amount) public {
        amount = uint128(bound(amount, 1, LIMIT));
        _deposit(investor, LIQUIDITY);
        uint256 id = _financed(amount);
        uint256 advance = pool.advanced(id);
        assertEq(advance, uint256(amount) * 9800 / 10_000);

        uint256 tBefore = usdc.balanceOf(treasury);
        vm.prank(payer);
        pool.repay(id);
        uint256 toTreasury = usdc.balanceOf(treasury) - tBefore;
        uint256 spread = amount - advance;
        assertEq(toTreasury, spread * 2000 / 10_000);
        assertEq(pool.totalAssets(), LIQUIDITY + spread - toTreasury);
        assertEq(usdc.balanceOf(address(pool)), pool.totalAssets());
    }
}
