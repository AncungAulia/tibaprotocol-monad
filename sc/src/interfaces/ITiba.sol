// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Shipment lifecycle. OVERDUE is never stored; see TibaPool.isOverdue.
enum Status {
    NONE,
    APPROVED,
    IN_TRANSIT,
    DELIVERED,
    DISPUTED,
    FINANCED,
    REPAID
}

struct Shipment {
    address payer;
    address carrier;
    address consignee;
    uint128 amount; // fee in USDC (6 decimals)
    uint64 dueDate;
    uint64 deliveredAt;
    uint32 receivedQty; // 0 = not recorded
    Status status;
}

interface IShipmentManager {
    function getShipment(uint256 id) external view returns (Shipment memory);
    function markFinanced(uint256 id, uint256 advance) external;
    function markRepaid(uint256 id, bool late) external;
}

interface ITibaPool {
    function creditLimit(address payer) external view returns (uint256);
    function outstanding(address payer) external view returns (uint256);
    function hasOverdue(address payer) external view returns (bool);
}
