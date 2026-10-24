// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC internal usdc;
    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");

    function setUp() public {
        vm.warp(1_760_000_000);
        usdc = new MockUSDC(owner);
    }

    function test_metadata() public view {
        assertEq(usdc.name(), "Test USDC");
        assertEq(usdc.symbol(), "USDC");
        assertEq(usdc.decimals(), 6);
    }

    function test_faucet_firstClaim() public {
        assertEq(usdc.nextClaimAt(alice), 0);
        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(usdc.lastClaim(alice), block.timestamp);
        assertEq(usdc.nextClaimAt(alice), block.timestamp + 1 hours);
    }

    function test_faucet_cooldown() public {
        vm.prank(alice);
        usdc.faucet();
        uint64 next = usdc.nextClaimAt(alice);

        vm.warp(next - 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.FaucetCooldown.selector, next));
        usdc.faucet();

        vm.warp(next);
        vm.prank(alice);
        usdc.faucet();
        assertEq(usdc.balanceOf(alice), 2_000e6);
    }

    function test_faucet_perWallet() public {
        vm.prank(alice);
        usdc.faucet();
        address bob = makeAddr("bob");
        vm.prank(bob);
        usdc.faucet();
        assertEq(usdc.balanceOf(bob), 1_000e6);
    }

    function test_mint_onlyOwner() public {
        vm.prank(owner);
        usdc.mint(alice, 5e6);
        assertEq(usdc.balanceOf(alice), 5e6);
        vm.prank(alice);
        vm.expectRevert();
        usdc.mint(alice, 1);
    }
}
