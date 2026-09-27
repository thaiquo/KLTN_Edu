// SPDX-License-Identifier: MIT
pragma solidity 0.8.36;

import {IEduConnectEscrow} from "./IEduConnectEscrow.sol";

/// @title IEduConnectEscrowV2
/// @notice Extended interface for EduConnect Escrow Version 2 with token rescue, batch cancellation, and extended dispute outcomes.
interface IEduConnectEscrowV2 is IEduConnectEscrow {
    event TokenRescued(address indexed token, address indexed to, uint256 amount);
    event AgreementBatchCancelled(bytes32[] agreementIds, bytes32 reasonHash, uint256 totalRefunded);
    event DisputeOpened(bytes32 indexed agreementId, bytes32 indexed sessionId, Outcome proposedOutcome, bytes32 evidenceHash);
    event DisputeResolved(bytes32 indexed agreementId, bytes32 indexed sessionId, Outcome finalOutcome, bytes32 resolutionHash);

    /// @notice Rescue any ERC-20 tokens sent to the contract by mistake.
    /// @dev Only callable by DEFAULT_ADMIN_ROLE.
    function rescueERC20(address token, address to, uint256 amount) external;

    /// @notice Cancel multiple agreements in a single transaction (batch operation for whole-class cancellations).
    /// @dev Only callable by ARBITRATOR_ROLE.
    function batchCancelAgreementsAndRefundUnused(bytes32[] calldata agreementIds, bytes32 reasonHash) external;

    /// @notice Extended dispute opening allowing complaints on BOTH_PRESENT or STUDENT_ABSENT_TUTOR_PRESENT.
    /// @dev Only callable by OPERATOR_ROLE within the 24h dispute window.
    function openDispute(bytes32 agreementId, bytes32 sessionId, bytes32 evidenceHash) external;

    /// @notice Extended dispute resolution allowing the arbitrator to assign any valid final outcome.
    /// @dev Only callable by ARBITRATOR_ROLE.
    function resolveDispute(
        bytes32 agreementId,
        bytes32 sessionId,
        Outcome finalOutcome,
        bytes32 resolutionHash
    ) external;
}
