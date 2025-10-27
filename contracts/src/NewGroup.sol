// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./PaymentGroup.sol";

/**
 * @title PaymentGroupFactory
 * @dev Factory contract for creating and managing PaymentGroup instances.
 * Provides access control for contract creation and maintains a registry of all created contracts with their parameters.
 * @notice Allows authorized creators to deploy new PaymentGroup contracts and provides query functions to retrieve contract details.
 */
contract PaymentGroupFactory is AccessControl {
    bytes32 public constant CREATOR_ROLE = keccak256("CREATOR_ROLE");

    /// @dev Struct to store information about created PaymentGroup contracts.
    struct PaymentGroupInfo {
        address contractAddress;
        address originToken;
        address paymentToken;
        address admin;
        uint256 rewardPercentBps;
        uint256 createdAt;
    }

    /// @dev Array of all created PaymentGroup contracts.
    PaymentGroupInfo[] private _createdGroups;

    /// @dev Mapping from contract address to its info for quick lookup.
    mapping(address => PaymentGroupInfo) private _groupInfo;

    /**
     * @dev Emitted when a new PaymentGroup contract is created.
     * @param contractAddress The address of the newly created contract.
     * @param originToken The origin token address used.
     * @param paymentToken The payment token address used.
     * @param admin The admin address used.
     * @param rewardPercentBps The reward percentage used.
     */
    event PaymentGroupCreated(
        address indexed contractAddress,
        address indexed originToken,
        address indexed paymentToken,
        address admin,
        uint256 rewardPercentBps
    );

    /**
     * @dev Initializes the factory contract.
     * Grants the DEFAULT_ADMIN_ROLE and CREATOR_ROLE to the deployer.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(CREATOR_ROLE, msg.sender);
    }

    /**
     * @dev Creates a new PaymentGroup contract with the specified parameters.
     * Only callable by accounts with CREATOR_ROLE.
     * @param _originToken The address of the origin ERC20 token.
     * @param _paymentToken The address of the mintable ERC20 token.
     * @param _admin The address to be granted admin and operator roles in the new contract.
     * @param _rewardPercentBps The initial reward percentage in basis points (max 1000000).
     * @return The address of the newly created PaymentGroup contract.
     */
    function createPaymentGroup(
        address _originToken,
        address _paymentToken,
        address _admin,
        uint256 _rewardPercentBps
    ) external onlyRole(CREATOR_ROLE) returns (address) {
        require(_admin != address(0), "Admin address cannot be zero");
        require(_rewardPercentBps <= 1000000, "Reward percentage cannot exceed 100%");
        require(_rewardPercentBps > 0, "Reward percentage must be greater than 0");

        PaymentGroup newGroup = new PaymentGroup(
            _originToken,
            _paymentToken,
            _admin,
            _rewardPercentBps
        );

        address contractAddress = address(newGroup);
        PaymentGroupInfo memory info = PaymentGroupInfo({
            contractAddress: contractAddress,
            originToken: _originToken,
            paymentToken: _paymentToken,
            admin: _admin,
            rewardPercentBps: _rewardPercentBps,
            createdAt: block.timestamp
        });

        _createdGroups.push(info);
        _groupInfo[contractAddress] = info;

        emit PaymentGroupCreated(
            contractAddress,
            _originToken,
            _paymentToken,
            _admin,
            _rewardPercentBps
        );

        return contractAddress;
    }

    /**
     * @dev Returns the total number of PaymentGroup contracts created.
     * @return The count of created contracts.
     */
    function getCreatedGroupsCount() external view returns (uint256) {
        return _createdGroups.length;
    }

    /**
     * @dev Returns information about a specific PaymentGroup contract by its address.
     * @param contractAddress The address of the PaymentGroup contract.
     * @return info The PaymentGroupInfo struct containing all details.
     */
    function getGroupInfo(address contractAddress) external view returns (PaymentGroupInfo memory) {
        require(_groupInfo[contractAddress].contractAddress != address(0), "Contract not found");
        return _groupInfo[contractAddress];
    }

    /**
     * @dev Returns a paginated list of all created PaymentGroup contracts.
     * @param offset The starting index for pagination.
     * @param limit The maximum number of results to return.
     * @return groups An array of PaymentGroupInfo structs.
     */
    function getCreatedGroups(uint256 offset, uint256 limit) external view returns (PaymentGroupInfo[] memory) {
        require(offset < _createdGroups.length, "Offset out of bounds");

        uint256 end = offset + limit;
        if (end > _createdGroups.length) {
            end = _createdGroups.length;
        }

        uint256 resultLength = end - offset;
        PaymentGroupInfo[] memory groups = new PaymentGroupInfo[](resultLength);

        for (uint256 i = 0; i < resultLength; i++) {
            groups[i] = _createdGroups[offset + i];
        }

        return groups;
    }    

    /**
     * @dev Returns all created PaymentGroup contracts. Use with caution for large numbers.
     * @return groups An array of all PaymentGroupInfo structs.
     */
    function getAllCreatedGroups() external view returns (PaymentGroupInfo[] memory) {
        return _createdGroups;
    }

    /**
     * @dev Grants CREATOR_ROLE to an account. Only callable by admin.
     * @param account The address to grant the role to.
     */
    function grantCreatorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(CREATOR_ROLE, account);
    }

    /**
     * @dev Revokes CREATOR_ROLE from an account. Only callable by admin.
     * @param account The address to revoke the role from.
     */
    function revokeCreatorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(CREATOR_ROLE, account);
    }
}
