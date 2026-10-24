// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice Testnet-only 6-decimal stablecoin with a public, rate-limited faucet.
/// @dev Intentionally NOT upgradeable. Other contracts take the token address as a deploy parameter,
///      so switching to a real testnet USDC only requires a config change.
contract MockUSDC is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000e6;
    uint256 public constant FAUCET_COOLDOWN = 1 hours;

    /// @notice Timestamp of the last faucet claim per wallet (0 = never claimed).
    mapping(address => uint64) public lastClaim;

    event FaucetClaimed(address indexed to, uint256 amount);

    error FaucetCooldown(uint64 nextClaimAt);

    constructor(address initialOwner) ERC20("Test USDC", "USDC") Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Sends FAUCET_AMOUNT to the caller. Reverts while the caller's cooldown is active.
    function faucet() external {
        uint64 next = nextClaimAt(msg.sender);
        if (block.timestamp < next) revert FaucetCooldown(next);
        lastClaim[msg.sender] = uint64(block.timestamp);
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetClaimed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Earliest timestamp at which `who` can claim again (0 if never claimed).
    function nextClaimAt(address who) public view returns (uint64) {
        uint64 last = lastClaim[who];
        if (last == 0) return 0;
        // forge-lint: disable-next-line(unsafe-typecast)
        return last + uint64(FAUCET_COOLDOWN); // 3600 fits in uint64
    }

    /// @notice Owner mint used by deploy/seed scripts.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
