// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {Status, Shipment, IShipmentManager, ITibaPool} from "./interfaces/ITiba.sol";

/// @title TibaPool
/// @notice Investor liquidity pool that advances 97.5% of a delivered shipment's fee to the carrier and
///         collects 100% from the payer at maturity. The spread is split 80% pool / 20% treasury.
///
/// Share accounting
///   totalAssets = idle   (USDC sitting in the pool, free to lend or withdraw)
///               + deployed (sum of advances currently out, valued at cost)
///   Deposits mint shares at the current share price; repayments add the pool's 80% of the spread to
///   `idle` without minting shares, so the price per share rises. Advances move value from `idle` to
///   `deployed`, so the share price does not move when the pool lends. Balances are tracked internally
///   (not via balanceOf), so direct token donations cannot manipulate the share price. A virtual
///   share/asset of 1 guards the empty-pool edge case.
///
/// Overdue tracking
///   For each payer we keep the list of their currently FINANCED shipment ids (swap-and-pop, O(1)
///   add/remove). `hasOverdue(payer)` scans that list; it is bounded by how many advances a payer can
///   have open under their credit limit, which is small in practice. This keeps `createShipment`'s
///   overdue check exact without a keeper, and repays stay O(1).
///
/// @dev UUPS upgradeable. State lives in an ERC-7201 namespaced struct. Upgrade rule: only APPEND new
///      fields to the end of `TibaPoolStorage` / `PayerStats`; never reorder or remove.
contract TibaPool is ITibaPool, Initializable, UUPSUpgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using SafeERC20 for IERC20;

    uint256 public constant ADVANCE_BPS = 9750;
    uint256 public constant PROTOCOL_SHARE_BPS = 2000;
    uint256 public constant BPS = 10_000;
    uint256 public constant GRACE = 60; // seconds (demo)

    struct PayerStats {
        uint64 repaidCount;
        uint64 lateCount;
        uint128 totalRepaid;
    }

    /// @custom:storage-location erc7201:tiba.storage.TibaPool
    struct TibaPoolStorage {
        IERC20 usdc;
        IShipmentManager manager;
        address treasury;
        // liquidity
        uint256 idle;
        uint256 deployed;
        uint256 totalShares;
        mapping(address => uint256) shares;
        // credit
        mapping(address => uint256) creditLimit;
        mapping(address => uint256) outstanding;
        mapping(address => PayerStats) stats;
        // per shipment
        mapping(uint256 => uint256) advanced; // advance paid for a shipment id (0 = not financed)
        // overdue tracking: open financed ids per payer + 1-based index for swap-and-pop
        mapping(address => uint256[]) openFinanced;
        mapping(uint256 => uint256) openIndex;
        // lifetime counters (for the UI)
        uint256 totalFeesToPool;
        uint256 totalFeesToTreasury;
    }

    // keccak256(abi.encode(uint256(keccak256("tiba.storage.TibaPool")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_LOCATION = 0x2d077eae8b7e920a46e0aafd28170c16a37964b53b49fd22fccfa490fd844800;

    // ---------------------------------------------------------------- events

    event Deposited(address indexed investor, uint256 assets, uint256 shares);
    event Withdrawn(address indexed investor, uint256 assets, uint256 shares);
    event CreditLimitSet(address indexed payer, uint256 limit);
    event TreasurySet(address indexed treasury);
    event AdvancePaid(
        uint256 indexed id, address indexed carrier, address indexed payer, uint256 amount, uint256 advance
    );
    event RepaymentReceived(
        uint256 indexed id,
        address indexed payer,
        address indexed from,
        uint256 amount,
        uint256 toPool,
        uint256 toTreasury,
        bool late
    );
    event PaidToCarrier(uint256 indexed id, address indexed carrier, uint256 amount, bool late);

    // ---------------------------------------------------------------- errors

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientShares(uint256 requested, uint256 balance);
    error InsufficientLiquidity(uint256 requested, uint256 available);
    error NotCarrier();
    error NotDelivered(Status current);
    error AlreadyFinanced();
    error CreditLimitExceeded(uint256 requested, uint256 outstanding, uint256 limit);
    error NotRepayable(Status current);

    // ---------------------------------------------------------------- init

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @dev `public` (not external) so the OZ upgrades validator recognises it as the parent initializer of V2+.
    function initialize(address initialOwner, address usdc_, address manager_, address treasury_) public initializer {
        if (usdc_ == address(0) || manager_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        __Ownable_init(initialOwner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        TibaPoolStorage storage $ = _s();
        $.usdc = IERC20(usdc_);
        $.manager = IShipmentManager(manager_);
        $.treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function _s() private pure returns (TibaPoolStorage storage $) {
        assembly {
            $.slot := STORAGE_LOCATION
        }
    }

    // ---------------------------------------------------------------- admin

    /// @notice Set by the backend's admin key when a payer is approved. 0 disables the payer.
    function setCreditLimit(address payer, uint256 limit) external onlyOwner {
        if (payer == address(0)) revert ZeroAddress();
        _s().creditLimit[payer] = limit;
        emit CreditLimitSet(payer, limit);
    }

    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        _s().treasury = treasury_;
        emit TreasurySet(treasury_);
    }

    // ---------------------------------------------------------------- investors

    /// @notice Deposit USDC and receive pool shares at the current share price.
    function deposit(uint256 assets) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        TibaPoolStorage storage $ = _s();
        shares = _toShares(assets, Math.Rounding.Floor);
        if (shares == 0) revert ZeroAmount();
        $.idle += assets;
        $.totalShares += shares;
        $.shares[msg.sender] += shares;
        $.usdc.safeTransferFrom(msg.sender, address(this), assets);
        emit Deposited(msg.sender, assets, shares);
    }

    /// @notice Burn `shares` and receive their USDC value. Only idle cash can leave the pool.
    function withdraw(uint256 shares) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        TibaPoolStorage storage $ = _s();
        uint256 bal = $.shares[msg.sender];
        if (shares > bal) revert InsufficientShares(shares, bal);
        assets = _toAssets(shares, Math.Rounding.Floor);
        if (assets > $.idle) revert InsufficientLiquidity(assets, $.idle);
        $.shares[msg.sender] = bal - shares;
        $.totalShares -= shares;
        $.idle -= assets;
        $.usdc.safeTransfer(msg.sender, assets);
        emit Withdrawn(msg.sender, assets, shares);
    }

    // ---------------------------------------------------------------- carrier

    /// @notice Carrier takes 97.5% of a DELIVERED shipment's fee from the pool, right away.
    ///         Repayment later uses the advance recorded here, so a rate change never touches it.
    function requestAdvance(uint256 id) external nonReentrant returns (uint256 advance) {
        TibaPoolStorage storage $ = _s();
        Shipment memory sh = $.manager.getShipment(id);
        if (msg.sender != sh.carrier) revert NotCarrier();
        if (sh.status != Status.DELIVERED) revert NotDelivered(sh.status);
        if ($.advanced[id] != 0) revert AlreadyFinanced();

        uint256 amount = sh.amount;
        uint256 out = $.outstanding[sh.payer];
        uint256 limit = $.creditLimit[sh.payer];
        if (out + amount > limit) revert CreditLimitExceeded(amount, out, limit);

        advance = amount * _advanceBps() / BPS;
        if (advance > $.idle) revert InsufficientLiquidity(advance, $.idle);

        // effects
        $.advanced[id] = advance;
        $.outstanding[sh.payer] = out + amount;
        $.idle -= advance;
        $.deployed += advance;
        $.openFinanced[sh.payer].push(id);
        $.openIndex[id] = $.openFinanced[sh.payer].length; // 1-based

        // interactions
        $.manager.markFinanced(id, advance);
        $.usdc.safeTransfer(sh.carrier, advance);
        emit AdvancePaid(id, sh.carrier, sh.payer, amount, advance);
    }

    // ---------------------------------------------------------------- payer

    /// @notice Pay the full fee. Anyone may call (usually the payer); the caller's USDC is pulled.
    ///         FINANCED: principal back to the pool, spread split 80% pool / 20% treasury.
    ///         DELIVERED (never financed): the full fee goes straight to the carrier.
    function repay(uint256 id) external nonReentrant {
        TibaPoolStorage storage $ = _s();
        Shipment memory sh = $.manager.getShipment(id);
        uint256 amount = sh.amount;
        bool late = block.timestamp > uint256(sh.dueDate) + GRACE;

        if (sh.status == Status.FINANCED) {
            uint256 advance = $.advanced[id];
            uint256 spread = amount - advance;
            uint256 toTreasury = spread * PROTOCOL_SHARE_BPS / BPS;
            uint256 toPool = spread - toTreasury;

            $.outstanding[sh.payer] -= amount;
            $.deployed -= advance;
            $.idle += advance + toPool;
            $.totalFeesToPool += toPool;
            $.totalFeesToTreasury += toTreasury;
            _removeOpen(sh.payer, id);
            _recordRepayment(sh.payer, amount, late);

            $.manager.markRepaid(id, late);
            $.usdc.safeTransferFrom(msg.sender, address(this), amount);
            if (toTreasury > 0) $.usdc.safeTransfer($.treasury, toTreasury);
            emit RepaymentReceived(id, sh.payer, msg.sender, amount, toPool, toTreasury, late);
        } else if (sh.status == Status.DELIVERED) {
            _recordRepayment(sh.payer, amount, late);
            $.manager.markRepaid(id, late);
            $.usdc.safeTransferFrom(msg.sender, sh.carrier, amount);
            emit PaidToCarrier(id, sh.carrier, amount, late);
        } else {
            revert NotRepayable(sh.status);
        }
    }

    // ---------------------------------------------------------------- views

    /// @notice FINANCED and past dueDate + GRACE.
    function isOverdue(uint256 id) public view returns (bool) {
        Shipment memory sh = _s().manager.getShipment(id);
        return sh.status == Status.FINANCED && block.timestamp > uint256(sh.dueDate) + GRACE;
    }

    /// @notice True if any of the payer's financed shipments is overdue.
    function hasOverdue(address payer) external view returns (bool) {
        TibaPoolStorage storage $ = _s();
        uint256[] storage ids = $.openFinanced[payer];
        uint256 len = ids.length;
        for (uint256 i; i < len; ++i) {
            if (block.timestamp > uint256($.manager.getShipment(ids[i]).dueDate) + GRACE) return true;
        }
        return false;
    }

    /// @notice Ids of the payer's currently financed (unpaid) shipments.
    function openFinancedOf(address payer) external view returns (uint256[] memory) {
        return _s().openFinanced[payer];
    }

    /// @notice Idle cash: what can be lent or withdrawn right now.
    function available() external view returns (uint256) {
        return _s().idle;
    }

    function totalAssets() public view returns (uint256) {
        TibaPoolStorage storage $ = _s();
        return $.idle + $.deployed;
    }

    function deployed() external view returns (uint256) {
        return _s().deployed;
    }

    function totalShares() external view returns (uint256) {
        return _s().totalShares;
    }

    function sharesOf(address investor) external view returns (uint256) {
        return _s().shares[investor];
    }

    /// @notice Current USDC value of an investor's shares (may exceed what is withdrawable now).
    function balanceOfAssets(address investor) external view returns (uint256) {
        return _toAssets(_s().shares[investor], Math.Rounding.Floor);
    }

    /// @notice Max USDC `investor` can withdraw now: min(value of their shares, available()).
    function maxWithdraw(address investor) external view returns (uint256) {
        TibaPoolStorage storage $ = _s();
        return Math.min(_toAssets($.shares[investor], Math.Rounding.Floor), $.idle);
    }

    /// @notice Max shares `investor` can burn now (for the withdraw call).
    function maxRedeem(address investor) external view returns (uint256) {
        TibaPoolStorage storage $ = _s();
        uint256 bal = $.shares[investor];
        if (_toAssets(bal, Math.Rounding.Floor) <= $.idle) return bal;
        return Math.min(bal, _toShares($.idle, Math.Rounding.Floor));
    }

    function convertToShares(uint256 assets) external view returns (uint256) {
        return _toShares(assets, Math.Rounding.Floor);
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return _toAssets(shares, Math.Rounding.Floor);
    }

    function creditLimit(address payer) external view returns (uint256) {
        return _s().creditLimit[payer];
    }

    function outstanding(address payer) external view returns (uint256) {
        return _s().outstanding[payer];
    }

    function payerStats(address payer) external view returns (PayerStats memory) {
        return _s().stats[payer];
    }

    /// @dev Advance rate applied at financing time. Virtual only so tests can model an older rate.
    function _advanceBps() internal pure virtual returns (uint256) {
        return ADVANCE_BPS;
    }

    function advanced(uint256 id) external view returns (uint256) {
        return _s().advanced[id];
    }

    function usdc() external view returns (address) {
        return address(_s().usdc);
    }

    function manager() external view returns (address) {
        return address(_s().manager);
    }

    function treasury() external view returns (address) {
        return _s().treasury;
    }

    function totalFeesToPool() external view returns (uint256) {
        return _s().totalFeesToPool;
    }

    function totalFeesToTreasury() external view returns (uint256) {
        return _s().totalFeesToTreasury;
    }

    // ---------------------------------------------------------------- internal

    function _toShares(uint256 assets, Math.Rounding r) internal view returns (uint256) {
        TibaPoolStorage storage $ = _s();
        return Math.mulDiv(assets, $.totalShares + 1, $.idle + $.deployed + 1, r);
    }

    function _toAssets(uint256 shares, Math.Rounding r) internal view returns (uint256) {
        TibaPoolStorage storage $ = _s();
        return Math.mulDiv(shares, $.idle + $.deployed + 1, $.totalShares + 1, r);
    }

    function _recordRepayment(address payer, uint256 amount, bool late) internal {
        PayerStats storage st = _s().stats[payer];
        st.repaidCount += 1;
        if (late) st.lateCount += 1;
        // forge-lint: disable-next-line(unsafe-typecast)
        st.totalRepaid += uint128(amount); // amount originates from a uint128 field
    }

    function _removeOpen(address payer, uint256 id) internal {
        TibaPoolStorage storage $ = _s();
        uint256[] storage ids = $.openFinanced[payer];
        uint256 idx = $.openIndex[id]; // 1-based
        uint256 last = ids.length;
        if (idx != last) {
            uint256 moved = ids[last - 1];
            ids[idx - 1] = moved;
            $.openIndex[moved] = idx;
        }
        ids.pop();
        delete $.openIndex[id];
    }
}
