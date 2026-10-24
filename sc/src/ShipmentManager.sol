// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import {Status, Shipment, IShipmentManager, ITibaPool} from "./interfaces/ITiba.sol";

/// @title ShipmentManager
/// @notice Records each shipment and moves it through the status cycle:
///         APPROVED -> IN_TRANSIT -> DELIVERED | DISPUTED, then DELIVERED -> FINANCED -> REPAID
///         or DELIVERED -> REPAID. FINANCED / REPAID are set only by the pool.
/// @dev UUPS upgradeable. State lives in an ERC-7201 namespaced struct, so upgrades never collide with
///      inherited OpenZeppelin storage. Upgrade rule: only APPEND new fields to the end of
///      `ShipmentManagerStorage` (and to `Shipment`, which is stored in a mapping); never reorder or remove.
contract ShipmentManager is IShipmentManager, Initializable, UUPSUpgradeable, OwnableUpgradeable {
    /// @custom:storage-location erc7201:tiba.storage.ShipmentManager
    struct ShipmentManagerStorage {
        mapping(uint256 => Shipment) shipments;
        uint256 nextId;
        address pool;
    }

    // keccak256(abi.encode(uint256(keccak256("tiba.storage.ShipmentManager")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION = 0xc1f9a93893c180f12b706f083f485dd8c6e4fcc8845acef1a6203415e1287800;

    // ---------------------------------------------------------------- events

    event ShipmentCreated(
        uint256 indexed id,
        address indexed payer,
        address indexed carrier,
        address consignee,
        uint256 amount,
        uint64 dueDate
    );
    event PickedUp(uint256 indexed id);
    event Delivered(uint256 indexed id, uint32 receivedQty);
    event Disputed(uint256 indexed id, uint32 receivedQty);
    event Financed(uint256 indexed id, uint256 advance);
    event Repaid(uint256 indexed id, bool late);
    event PoolSet(address indexed pool);

    // ---------------------------------------------------------------- errors

    error ZeroAddress();
    error InvalidAmount();
    error InvalidDueDate();
    error PoolNotSet();
    error OnlyPool();
    error NotApprovedPayer();
    error CreditLimitExceeded(uint256 requested, uint256 outstanding, uint256 limit);
    error PayerHasOverdue();
    error NotCarrier();
    error NotConsignee();
    error InvalidStatus(Status current);

    // ---------------------------------------------------------------- init

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev `public` (not external) so the OZ upgrades validator recognises it as the parent initializer of V2+.
    function initialize(address initialOwner) public initializer {
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();
        // Ids start at 1 so that 0 can mean "no shipment" off-chain.
        _s().nextId = 1;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _s() private pure returns (ShipmentManagerStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    // ---------------------------------------------------------------- admin

    /// @notice Wires the pool. Only the pool may set FINANCED / REPAID.
    function setPool(address pool_) external onlyOwner {
        if (pool_ == address(0)) revert ZeroAddress();
        _s().pool = pool_;
        emit PoolSet(pool_);
    }

    // ---------------------------------------------------------------- payer / carrier / consignee

    /// @notice Payer approves a shipment's fee and due date before the truck leaves (one transaction).
    ///         Fee and due date are immutable afterwards.
    function createShipment(address carrier, address consignee, uint128 amount, uint64 dueDate)
        external
        returns (uint256 id)
    {
        ShipmentManagerStorage storage $ = _s();
        address pool_ = $.pool;
        if (pool_ == address(0)) revert PoolNotSet();
        if (carrier == address(0) || consignee == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        if (dueDate <= block.timestamp) revert InvalidDueDate();

        ITibaPool p = ITibaPool(pool_);
        uint256 limit = p.creditLimit(msg.sender);
        if (limit == 0) revert NotApprovedPayer();
        uint256 out = p.outstanding(msg.sender);
        if (out + amount > limit) revert CreditLimitExceeded(amount, out, limit);
        if (p.hasOverdue(msg.sender)) revert PayerHasOverdue();

        id = $.nextId++;
        $.shipments[id] = Shipment({
            payer: msg.sender,
            carrier: carrier,
            consignee: consignee,
            amount: amount,
            dueDate: dueDate,
            deliveredAt: 0,
            receivedQty: 0,
            status: Status.APPROVED
        });
        emit ShipmentCreated(id, msg.sender, carrier, consignee, amount, dueDate);
    }

    /// @notice Carrier confirms pickup. APPROVED -> IN_TRANSIT.
    function confirmPickup(uint256 id) external {
        Shipment storage sh = _s().shipments[id];
        if (sh.status != Status.APPROVED) revert InvalidStatus(sh.status);
        if (msg.sender != sh.carrier) revert NotCarrier();
        sh.status = Status.IN_TRANSIT;
        emit PickedUp(id);
    }

    /// @notice Consignee confirms arrival. IN_TRANSIT -> DELIVERED (accepted) or DISPUTED.
    function confirmDelivery(uint256 id, bool accepted, uint32 receivedQty) external {
        Shipment storage sh = _s().shipments[id];
        if (sh.status != Status.IN_TRANSIT) revert InvalidStatus(sh.status);
        if (msg.sender != sh.consignee) revert NotConsignee();
        sh.receivedQty = receivedQty;
        if (accepted) {
            sh.status = Status.DELIVERED;
            sh.deliveredAt = uint64(block.timestamp);
            emit Delivered(id, receivedQty);
        } else {
            sh.status = Status.DISPUTED;
            emit Disputed(id, receivedQty);
        }
    }

    // ---------------------------------------------------------------- pool hooks

    modifier onlyPool() {
        _onlyPool();
        _;
    }

    function _onlyPool() internal view {
        if (msg.sender != _s().pool) revert OnlyPool();
    }

    /// @notice DELIVERED -> FINANCED. Called by the pool when it pays the advance.
    function markFinanced(uint256 id, uint256 advance) external onlyPool {
        Shipment storage sh = _s().shipments[id];
        if (sh.status != Status.DELIVERED) revert InvalidStatus(sh.status);
        sh.status = Status.FINANCED;
        emit Financed(id, advance);
    }

    /// @notice DELIVERED | FINANCED -> REPAID. Called by the pool on repayment.
    function markRepaid(uint256 id, bool late) external onlyPool {
        Shipment storage sh = _s().shipments[id];
        if (sh.status != Status.DELIVERED && sh.status != Status.FINANCED) revert InvalidStatus(sh.status);
        sh.status = Status.REPAID;
        emit Repaid(id, late);
    }

    // ---------------------------------------------------------------- views

    function getShipment(uint256 id) external view returns (Shipment memory) {
        return _s().shipments[id];
    }

    /// @notice Flattened view with the same outputs as a public `shipments` mapping getter (spec parity).
    function shipments(uint256 id)
        external
        view
        returns (
            address payer,
            address carrier,
            address consignee,
            uint128 amount,
            uint64 dueDate,
            uint64 deliveredAt,
            uint32 receivedQty,
            Status status
        )
    {
        Shipment storage sh = _s().shipments[id];
        return (sh.payer, sh.carrier, sh.consignee, sh.amount, sh.dueDate, sh.deliveredAt, sh.receivedQty, sh.status);
    }

    function statusOf(uint256 id) external view returns (Status) {
        return _s().shipments[id].status;
    }

    function nextId() external view returns (uint256) {
        return _s().nextId;
    }

    function pool() external view returns (address) {
        return _s().pool;
    }
}
