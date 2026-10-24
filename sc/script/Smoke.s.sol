// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";

import {MockUSDC} from "../src/MockUSDC.sol";
import {ShipmentManager} from "../src/ShipmentManager.sol";
import {TibaPool} from "../src/TibaPool.sol";
import {Status, Shipment} from "../src/interfaces/ITiba.sol";

/// @notice End-to-end smoke test on the live deployment, with throwaway wallets:
///         create -> pickup -> arrival -> carrier paid 98% -> payer repays.
///         Only PRIVATE_KEY (the owner) is required. Costs about 0.5 MON.
///         Below 10 MON, Monad rejects a MON transfer sent right after another transaction from the
///         same account. If a funding transfer fails, send it with `cast send` and rerun with the
///         SMOKE_SALT printed by the failed run: steps already done are skipped.
///
///   forge script script/Smoke.s.sol --rpc-url monad --broadcast --slow
///
/// Env:
///   PRIVATE_KEY      owner of MockUSDC and TibaPool
///   SMOKE_SALT       optional; new throwaway wallets per salt (default: block timestamp)
///   SMOKE_GAS_MON    optional wei of MON per throwaway wallet, default 0.1 MON
contract Smoke is Script {
    uint128 constant FEE = 300e6;
    uint32 constant BOXES = 120;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        string memory json =
            vm.readFile(string.concat(vm.projectRoot(), "/deployments/", vm.toString(block.chainid), ".json"));
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(json, ".mockUsdc"));
        ShipmentManager sm = ShipmentManager(vm.parseJsonAddress(json, ".shipmentManager"));
        TibaPool pool = TibaPool(vm.parseJsonAddress(json, ".tibaPool"));

        uint256 salt = vm.envOr("SMOKE_SALT", block.timestamp);
        uint256 payerPk = _key(pk, salt, "payer");
        uint256 carrierPk = _key(pk, salt, "carrier");
        uint256 consigneePk = _key(pk, salt, "consignee");
        address payer = vm.addr(payerPk);
        address carrier = vm.addr(carrierPk);
        address consignee = vm.addr(consigneePk);
        uint256 gasMon = vm.envOr("SMOKE_GAS_MON", uint256(0.1 ether));

        console.log("salt     ", salt);
        console.log("payer    ", payer);
        console.log("carrier  ", carrier);
        console.log("consignee", consignee);

        // Owner: gas money, credit limit, and USDC for the payer to settle the bill
        vm.startBroadcast(pk);
        // Skips what a failed earlier run with the same SMOKE_SALT already did
        if (payer.balance < gasMon) payable(payer).transfer(gasMon);
        if (carrier.balance < gasMon) payable(carrier).transfer(gasMon);
        if (consignee.balance < gasMon) payable(consignee).transfer(gasMon);
        if (pool.creditLimit(payer) == 0) pool.setCreditLimit(payer, 1_000e6);
        if (usdc.balanceOf(payer) < FEE) usdc.mint(payer, FEE);
        vm.stopBroadcast();

        uint256 availableBefore = pool.available();

        vm.startBroadcast(payerPk);
        uint256 id = sm.createShipment(carrier, consignee, FEE, uint64(block.timestamp + 30 days));
        vm.stopBroadcast();
        _expect(sm, id, Status.APPROVED, "create");

        vm.startBroadcast(carrierPk);
        sm.confirmPickup(id);
        vm.stopBroadcast();
        _expect(sm, id, Status.IN_TRANSIT, "pickup");

        vm.startBroadcast(consigneePk);
        sm.confirmDelivery(id, true, BOXES);
        vm.stopBroadcast();
        _expect(sm, id, Status.DELIVERED, "arrival");

        vm.startBroadcast(carrierPk);
        uint256 advance = pool.requestAdvance(id);
        vm.stopBroadcast();
        _expect(sm, id, Status.FINANCED, "advance");
        require(advance == 294e6, "advance is not 98%");
        require(usdc.balanceOf(carrier) == advance, "carrier not paid");
        require(pool.outstanding(payer) == FEE, "outstanding not recorded");

        vm.startBroadcast(payerPk);
        usdc.approve(address(pool), FEE);
        pool.repay(id);
        vm.stopBroadcast();
        _expect(sm, id, Status.REPAID, "repay");
        require(pool.outstanding(payer) == 0, "outstanding not cleared");
        // 80% of the 6 USDC spread stays in the pool
        require(pool.available() == availableBefore + 4.8e6, "pool did not earn its share");

        console.log("shipment id", id);
        console.log("carrier got", advance);
        console.log("pool available", pool.available());
        console.log("SMOKE OK");
    }

    function _key(uint256 pk, uint256 salt, string memory role) private pure returns (uint256) {
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        return uint256(keccak256(abi.encode(pk, salt, role))) % (n - 1) + 1;
    }

    function _expect(ShipmentManager sm, uint256 id, Status want, string memory step) private view {
        Shipment memory sh = sm.getShipment(id);
        require(sh.status == want, string.concat("wrong status after ", step));
        console.log("ok:", step);
    }
}
