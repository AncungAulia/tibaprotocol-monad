// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {TibaPool} from "../src/TibaPool.sol";

/// @notice Demo seeding. Only PRIVATE_KEY is required: it fills the pool so carriers can be paid early.
///         Everyone else connects their own wallet, picks a role in the app and gets test USDC from the faucet.
///         The demo wallet variables below are optional shortcuts for stage rehearsals.
///
///   forge script script/Seed.s.sol --rpc-url monad --broadcast
///
/// Env:
///   PRIVATE_KEY                          owner of MockUSDC and TibaPool
///   PAYER, CARRIER, CONSIGNEE, INVESTOR  optional demo wallets: get DEMO_USDC (and DEMO_MON); PAYER gets CREDIT_LIMIT
///   INVESTOR_PRIVATE_KEY                 optional; if set the investor (Rina) also deposits INVESTOR_DEPOSIT
///   CREDIT_LIMIT                         default 3,000 USDC
///   DEMO_USDC                            MockUSDC per demo wallet, default 5,000 USDC
///   SEED_LIQUIDITY                       owner deposit standing in for other investors, default 20,000 USDC
///   INVESTOR_DEPOSIT                     Rina's deposit, default 5,000 USDC (20% of a 25,000 pool, as in the design)
///   DEMO_MON                             optional wei of MON per demo wallet, default 0
///   MOCK_USDC, TIBA_POOL                 optional overrides; default from deployments/<chainId>.json
contract Seed is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);

        string memory json =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
        MockUSDC usdc = MockUSDC(vm.envOr("MOCK_USDC", vm.parseJsonAddress(json, ".mockUsdc")));
        TibaPool pool = TibaPool(vm.envOr("TIBA_POOL", vm.parseJsonAddress(json, ".tibaPool")));

        address payer = vm.envOr("PAYER", address(0));
        address[4] memory wallets = [
            payer,
            vm.envOr("CARRIER", address(0)),
            vm.envOr("CONSIGNEE", address(0)),
            vm.envOr("INVESTOR", address(0))
        ];

        uint256 creditLimit = vm.envOr("CREDIT_LIMIT", uint256(3_000e6));
        uint256 demoUsdc = vm.envOr("DEMO_USDC", uint256(5_000e6));
        uint256 liquidity = vm.envOr("SEED_LIQUIDITY", uint256(20_000e6));
        uint256 demoMon = vm.envOr("DEMO_MON", uint256(0));
        uint256 investorPk = vm.envOr("INVESTOR_PRIVATE_KEY", uint256(0));
        uint256 investorDeposit = investorPk == 0 ? 0 : vm.envOr("INVESTOR_DEPOSIT", uint256(5_000e6));

        vm.startBroadcast(pk);
        if (payer != address(0)) pool.setCreditLimit(payer, creditLimit);
        for (uint256 i; i < wallets.length; ++i) {
            if (wallets[i] == address(0)) continue;
            if (demoUsdc > 0) usdc.mint(wallets[i], demoUsdc);
            if (demoMon > 0) payable(wallets[i]).transfer(demoMon);
        }
        // The pool must hold cash before the first "Get paid now", or the advance has nothing to pay from
        if (liquidity > 0) {
            usdc.mint(owner, liquidity);
            usdc.approve(address(pool), liquidity);
            pool.deposit(liquidity);
        }
        if (investorDeposit > 0) usdc.mint(vm.addr(investorPk), investorDeposit);
        vm.stopBroadcast();

        if (investorDeposit > 0) {
            vm.startBroadcast(investorPk);
            usdc.approve(address(pool), investorDeposit);
            pool.deposit(investorDeposit);
            vm.stopBroadcast();
        }

        console.log("credit limit (payer)", creditLimit);
        console.log("pool available      ", pool.available());
    }
}
