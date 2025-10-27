// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IMintableERC20.sol";

/**
 * @title PaymentGroup
 * @dev This contract manages a group of participants and distributes rewards in a payment token based on a percentage of their origin token balance.
 * Rewards are triggered manually by authorized operators. The contract ensures secure access control and prevents unauthorized actions.
 * @notice Administrators can configure tokens, set reward parameters, manage participants, and control contract pausing.
 * Participants are rewarded proportionally to their origin token holdings when distributions are triggered.
 */
contract PaymentGroup is AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    /// @dev The origin ERC20 token from which balances are checked for reward calculations.
    IERC20 public originToken;
    /// @dev The mintable ERC20 token used for distributing rewards.
    IMintableERC20 public paymentToken;

    /// @dev Reward percentage in basis points (10000 = 1%, 1000000 = 100%).
    uint256 public rewardPercentBps;

    /// @dev Indicates if the contract is paused.
    bool private _paused;

    /// @dev Set of participant addresses.
    EnumerableSet.AddressSet private participants;

    /**
     * @dev Emitted when a participant is added.
     * @param account The address of the added participant.
     */
    event ParticipantAdded(address indexed account);

    /**
     * @dev Emitted when a participant is removed.
     * @param account The address of the removed participant.
     */
    event ParticipantRemoved(address indexed account);

    /**
     * @dev Emitted when a reward distribution is triggered.
     * @param blockNumber The block number at which the trigger occurred.
     * @param percentBps The reward percentage used.
     * @param participantsCount The number of participants at the time of trigger.
     */
    event RewardTriggered(uint256 blockNumber, uint256 percentBps, uint256 participantsCount);

    /**
     * @dev Emitted when a reward is paid to a participant.
     * @param account The address of the rewarded participant.
     * @param balanceA The participant's origin token balance at the time of calculation.
     * @param rewardAmount The amount of payment tokens minted as reward.
     * @param percentBps The reward percentage applied.
     */
    event RewardPaid(address indexed account, uint256 balanceA, uint256 rewardAmount, uint256 percentBps);

    /**
     * @dev Emitted when the reward percentage is updated.
     * @param oldValue The previous reward percentage.
     * @param newValue The new reward percentage.
     */
    event PercentUpdated(uint256 oldValue, uint256 newValue);

    /**
     * @dev Emitted when the contract is paused.
     * @param by The address that paused the contract.
     */
    event Paused(address indexed by);

    /**
     * @dev Emitted when the contract is unpaused.
     * @param by The address that unpaused the contract.
     */
    event Unpaused(address indexed by);

    /**
     * @dev Emitted when tokens are configured.
     * @param originToken The address of the origin token.
     * @param paymentToken The address of the payment token.
     */
    event TokensConfigured(address originToken, address paymentToken);

    /**
     * @dev Initializes the contract with the specified parameters.
     * @param _originToken The address of the origin ERC20 token. Can be zero if set later.
     * @param _paymentToken The address of the mintable ERC20 token. Can be zero if set later.
     * @param _admin The address to be granted admin and operator roles. Must not be zero.
     * @param _rewardPercentBps The initial reward percentage in basis points (max 1000000).
     */
    constructor(
        address _originToken,
        address _paymentToken,
        address _admin,
        uint256 _rewardPercentBps
    ) {
        require(_admin != address(0), "Admin address cannot be zero");
        require(_rewardPercentBps <= 1000000, "Reward percentage cannot exceed 100%");
        require(_rewardPercentBps > 0, "Reward percentage must be greater than 0");
        if (_originToken != address(0) && _paymentToken != address(0)) {
            originToken = IERC20(_originToken);
            paymentToken = IMintableERC20(_paymentToken);
        }
        rewardPercentBps = _rewardPercentBps;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);
    }

    /**
     * @dev Allows the admin to configure or reconfigure the tokens if not already set.
     * @param _tokenA The address of the origin token.
     * @param _tokenB The address of the payment token.
     */
    function setTokens(address _tokenA, address _tokenB) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenA != address(0) && _tokenB != address(0), "Token addresses cannot be zero");
        originToken = IERC20(_tokenA);
        paymentToken = IMintableERC20(_tokenB);
        emit TokensConfigured(_tokenA, _tokenB);
    }

    /**
     * @dev Updates the reward percentage. Only callable by admin.
     * @param newPercent The new reward percentage in basis points (max 1000000).
     */
    function setRewardPercentBps(uint256 newPercent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPercent <= 1000000, "Reward percentage cannot exceed 100%");
        require(newPercent > 0, "Reward percentage must be greater than 0");
        emit PercentUpdated(rewardPercentBps, newPercent);
        rewardPercentBps = newPercent;
    }

    /**
     * @dev Pauses the contract, preventing reward triggers and participant management. Only callable by admin.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _paused = true;
        emit Paused(msg.sender);
    }

    /**
     * @dev Unpauses the contract. Only callable by admin.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    /**
     * @dev Returns whether the contract is paused.
     * @return True if paused, false otherwise.
     */
    function paused() public view returns (bool) {
        return _paused;
    }

    /**
     * @dev Grants operator role to an account. Only callable by admin.
     * @param account The address to grant the role to.
     */
    function grantOperator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, account);
    }

    /**
     * @dev Adds a participant to the group. Only callable by operator.
     * @param account The address of the participant to add.
     */
    function addParticipant(address account) external onlyRole(OPERATOR_ROLE) {
        require(!_paused, "Contract is paused");
        require(account != address(0), "Participant address cannot be zero");
        require(participants.add(account), "Account is already a participant");
        emit ParticipantAdded(account);
    }

    /**
     * @dev Removes a participant from the group. Only callable by operator.
     * @param account The address of the participant to remove.
     */
    function removeParticipant(address account) external onlyRole(OPERATOR_ROLE) {
        require(!_paused, "Contract is paused");
        require(participants.remove(account), "Account is not a participant");
        emit ParticipantRemoved(account);
    }

    /**
     * @dev Returns the list of all participants.
     * @return list An array of participant addresses.
     */
    function getParticipants() external view returns (address[] memory list) {
        list = participants.values();
    }

    /**
     * @dev Returns the number of participants.
     * @return The count of participants.
     */
    function participantsCount() external view returns (uint256) {
        return participants.length();
    }

    /**
     * @dev Triggers a reward distribution to all participants. Only callable by operator.
     */
    function triggerPayment() external onlyRole(OPERATOR_ROLE) {
        require(!_paused, "Contract is paused");
        _distribute();
    }

    /**
     * @dev Previews the reward for a specific user without executing the distribution.
     * @param user The address of the user.
     * @return balanceA The user's origin token balance.
     * @return rewardAmount The calculated reward amount.
     */
    function previewUserReward(address user) public view returns (uint256 balanceA, uint256 rewardAmount) {
        require(address(originToken) != address(0), "Origin token not configured");
        balanceA = originToken.balanceOf(user);
        if (balanceA == 0) return (0, 0);
        rewardAmount = (balanceA * rewardPercentBps) / 1000000;
    }

    /**
     * @dev Previews rewards for all participants without executing the distribution.
     * @return accounts An array of participant addresses.
     * @return rewards An array of corresponding reward amounts.
     */
    function previewAllRewards() external view returns (address[] memory accounts, uint256[] memory rewards) {
        require(address(originToken) != address(0), "Origin token not configured");
        uint256 len = participants.length();
        accounts = new address[](len);
        rewards = new uint256[](len);
        uint256 percent = rewardPercentBps;
        for (uint256 i = 0; i < len; i++) {
            address user = participants.at(i);
            accounts[i] = user;
            uint256 balanceA = originToken.balanceOf(user);
            if (balanceA == 0) {
                rewards[i] = 0;
            } else {
                rewards[i] = (balanceA * percent) / 1000000;
            }
        }
    }

    /**
     * @dev Internal function to distribute rewards to participants.
     * Ensures that tokens are configured.
     */
    function _distribute() internal {
        require(address(originToken) != address(0) && address(paymentToken) != address(0), "Tokens not configured");
        uint256 len = participants.length();
        uint256 percent = rewardPercentBps;
        for (uint256 i = 0; i < len; i++) {
            address user = participants.at(i);
            uint256 balanceA = originToken.balanceOf(user);
            if (balanceA == 0) continue;
            uint256 rewardAmount = (balanceA * percent) / 1000000;
            if (rewardAmount > 0) {
                paymentToken.mint(user, rewardAmount);
                emit RewardPaid(user, balanceA, rewardAmount, percent);
            }
        }
        emit RewardTriggered(block.number, percent, len);
    }
}