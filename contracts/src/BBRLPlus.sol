// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.4.0
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {LibErrors} from "./Utils/Errors.sol";

contract DEMOBR is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ERC20Permit {
    
    using EnumerableSet for EnumerableSet.AddressSet;
    
    /**
	 * @notice The Access Control identifier for the Pauser Role.
	 * An account with "PAUSER_ROLE" can pause the contract.
	 *
	 * @dev This constant holds the hash of the string "PAUSER_ROLE".
	 */
	bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    /**
	 * @notice The Access Control identifier for the Minter Role.
	 * An account with "MINTER_ROLE" can mint tokens.
	 *
	 * @dev This constant holds the hash of the string "MINTER_ROLE".
	 */
	bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
	 * @notice The Access Control identifier for the Burner Role.
	 * An account with "BURNER_ROLE" can burn tokens.
	 *
	 * @dev This constant holds the hash of the string "BURNER_ROLE".
	 */
	bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    /**
	 * @notice The Access Control identifier for the Recovery Role.
	 * An account with "RECOVERY_ROLE" can recover tokens.
	 *
	 * @dev This constant holds the hash of the string "RECOVERY_ROLE".
	 */
	bytes32 public constant RECOVERY_ROLE = keccak256("RECOVERY_ROLE");

	// Deny list of addresses that are NOT allowed to participate (cannot send or receive tokens).
	EnumerableSet.AddressSet internal _denyList;

    /**
	 * @notice This event is logged when the funds are recovered from an address that is not allowed
	 * to participate in the system.
	 *
	 * @param account The (indexed) account the tokens were recovered from.
	 * @param amount The number of tokens recovered.
	 */
	event TokensRecovered(address indexed account, string indexed ref , uint256 amount);

    /**
     * @notice This event is logged when new tokens are minted.
     *
     * @param to The address that received the minted tokens.
     * @param ref A reference string for off-chain tracking.
     * @param amount The number of tokens minted.
     */
    event TokensMinted(address indexed to, string indexed ref, uint256 amount);

    /**
     * @notice This event is logged when tokens are burned.
     *
     * @param from The address from which the tokens were burned.
     * @param ref A reference string for off-chain tracking.
     * @param amount The number of tokens burned.
     */
    event TokensBurned(address indexed from, string indexed ref, uint256 amount);

    /**
     * @notice This event is logged when tokens are transferred with a reference.
     *
     * @param to The address that received the tokens.
     * @param ref A reference string for off-chain tracking.
     * @param amount The number of tokens transferred.
     */
    event TokensTransferred( address indexed to, string indexed ref, uint256 amount);

    constructor(address defaultAdmin, address pauser, address minter , address burner, address recovery, string memory name, string memory symbol)
        ERC20(name, symbol)
        ERC20Permit(name)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(BURNER_ROLE, burner);
        _grantRole(RECOVERY_ROLE, recovery);
    }


    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }


    /**
	 * @notice This is a function used to issue new tokens.
	 * The caller will issue tokens to the `to` address.
	 *
	 * @dev Calling Conditions:
	 *
	 * - Can only be invoked by the address that has the role "MINTER_ROLE".
	 * - {ERC20} is not paused. (checked internally by {_beforeTokenTransfer})
	 * - `to` is allowed to receive tokens.
	 *
	 * This function emits a {Transfer} event as part of {ERC20._mint}.
	 *
	 * @param to The address that will receive the issued tokens.
	 * @param amount The number of tokens to be issued.
     * @param ref A reference string for off-chain tracking.
	 */
    function mintRef(address to, uint256 amount, string memory ref) public whenNotPaused onlyRole(MINTER_ROLE) {
        _mint(to, amount);
        emit TokensMinted(to, ref, amount);
    }

    /**
	 * @notice This is a function used to burn tokens.
	 * The caller will burn tokens from their own address.
	 *
	 * @dev Calling Conditions:
	 *
	 * - Can only be invoked by the address that has the role "BURNER_ROLE".
	 * - {ERC20F} is not paused. (checked internally by {_beforeTokenTransfer})
	 * - `amount` is less than or equal to the caller's balance. (checked internally by {ERC20Upgradeable}.{_burn})
	 * - `amount` is greater than 0. (checked internally by {ERC20Upgradeable}.{_burn})
	 *
	 * This function emits a {Transfer} event as part of {ERC20Upgradeable._burn}.
	 *
	 * @param amount The number of tokens to be burned.
	 */
	function burnFromRef(address to, string memory ref, uint256 amount) public virtual whenNotPaused onlyRole(BURNER_ROLE) {
		_burn(to, amount);
		emit TokensBurned(to, ref, amount);   
	}

    /**
	 * @notice This is a function used to recover tokens from an address that is on the deny list.
	 *
	 * @dev Calling Conditions:
	 *
	 * - `caller` of this function must have the "RECOVERY_ROLE".
	 * - {ERC20F} is not paused.(checked internally by {_beforeTokenTransfer}).
	 * - `account` address must be present in the deny list (not allowed to hold tokens).
	 * - `account` must be a non-zero address. (checked internally in {ERC20Upgradeable._transfer})
	 * - `amount` is greater than 0.
	 * - `amount` is less than or equal to the balance of the account. (checked internally in {ERC20Upgradeable._transfer})
	 *
	 * This function emits a {TokensRecovered} event, signalling that the funds of the given address were recovered.
	 *
	 * @param account The address (on the deny list) to recover the tokens from.
	 * @param amount The amount to be recovered from the balance of the `account`.
	 */
	function recoverTokens(address account, string memory ref ,uint256 amount) external virtual onlyRole(RECOVERY_ROLE) {
		if (amount == 0) revert LibErrors.ZeroAmount();
		emit TokensRecovered(account,ref, amount);
		_transfer(account, _msgSender(), amount);
	}

    /**
	/**
	 * @notice Add an address to the deny list (blocks participation).
	 * @dev Only accounts with DEFAULT_ADMIN_ROLE can call this function.
	 * @param account The address to add to the deny list.
	 */
	function addToDenylist(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
		require(account != address(0), "Cannot add zero address");
		_denyList.add(account);
	}

	/**
	 * @notice Remove an address from the deny list (re-allows participation).
	 * @dev Only accounts with DEFAULT_ADMIN_ROLE can call this function.
	 * @param account The address to remove from the deny list.
	 */
	function removeFromDenylist(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
		_denyList.remove(account);
	}

	/**
	 * @notice Check if an address is denied.
	 * @param account The address to check.
	 * @return True if the address is in the deny list, false otherwise.
	 */
	function isDenied(address account) external view returns (bool) {
		return _denyList.contains(account);
	}

	/**
	 * @notice Get the number of addresses in the deny list.
	 * @return The total count of addresses in the deny list.
	 */
	function getDenylistLength() external view returns (uint256) {
		return _denyList.length();
	}

	/**
	 * @notice Get an address from the deny list by index.
	 * @param index The index of the address to retrieve.
	 * @return The address at the specified index.
	 */
	function getDenylistAddress(uint256 index) external view returns (address) {
		return _denyList.at(index);
	}

    /**
	 * @notice This is a function used to transfer tokens from the sender to
	 * the `to` address.
	 *
	 * @dev Calling Conditions:
	 *
	 * - {ERC20} is not paused. (checked internally by {_beforeTokenTransfer})
	 * - The `sender` is allowed to send tokens.
	 * - The `to` is allowed to receive tokens.
	 * - `to` is a non-zero address. (checked internally by {ERC20}.{_transfer})
	 * - `amount` is not greater than sender's balance. (checked internally by {ERC20}.{_transfer})
	 *
	 * This function emits a {Transfer} event as part of {ERC20._transfer}.
	 *
	 * @param to The address that will receive the tokens.
	 * @param amount The number of tokens that will be sent to the `recipient`.
	 * @return True if the function was successful.
	 */
	function transfer(address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
		if(_denyList.contains(to)) {
			revert LibErrors.UnauthorizedReceiver();
		}
		if(_denyList.contains(_msgSender())) {
			revert LibErrors.UnauthorizedCaller();
		}
		return super.transfer(to, amount);
	}

    /**
	 * @notice This is a function used to transfer tokens from the sender to
	 * the `to` address with a reference string.
	 *
	 * @dev Calling Conditions:
	 *
	 * - {ERC20} is not paused. (checked internally by {_beforeTokenTransfer})
	 * - The `sender` is allowed to send tokens.
	 * - The `to` is allowed to receive tokens.
	 * - `to` is a non-zero address. (checked internally by {ERC20}.{_transfer})
	 * - `amount` is not greater than sender's balance. (checked internally by {ERC20}.{_transfer})
	 *
	 * This function emits a {Transfer} event as part of {ERC20._transfer}.
	 * This function emits a {TokensTransferred} event.
	 *
	 * @param to The address that will receive the tokens.
	 * @param amount The number of tokens that will be sent to the `recipient`.
	 * @param ref A reference string for off-chain tracking.
	 * @return True if the function was successful.
	 */
	function transferWithRef(address to, uint256 amount, string memory ref) public virtual whenNotPaused returns (bool) {
		if(_denyList.contains(to)) {
			revert LibErrors.UnauthorizedReceiver();
		}
		if(_denyList.contains(_msgSender())) {
			revert LibErrors.UnauthorizedCaller();
		}
		emit TokensTransferred(to, ref, amount);
		return super.transfer(to, amount);
	}

	/**
	 * @notice This is a function used to transfer tokens on behalf of the `from` address to
	 * the `to` address.
	 *
	 * This function emits an {Approval} event as part of {ERC20._approve}.
	 * This function emits a {Transfer} event as part of {ERC20._transfer}.
	 *
	 * @dev Calling Conditions:
	 *
	 * - {ERC20} is not paused. (checked internally by {_beforeTokenTransfer})
	 * - The `from` is allowed to send tokens.
	 * - The `to` is allowed to receive tokens.
	 * - `from` is a non-zero address. (checked internally by {ERC20}.{_transfer})
	 * - `to` is a non-zero address. (checked internally by {ERC20}.{_transfer})
	 * - `amount` is not greater than `from`'s balance or caller's allowance of `from`'s funds. (checked internally
	 *   by {ERC20}.{transferFrom})
	 * - `amount` is greater than 0. (checked internally by {_spendAllowance})
	 *
	 * @param from The address that tokens will be transferred on behalf of.
	 * @param to The address that will receive the tokens.
	 * @param amount The number of tokens that will be sent to the `to` (recipient).
	 * @return True if the function was successful.
	 */
	function transferFrom(address from, address to, uint256 amount) public virtual override whenNotPaused returns (bool) {
		if(_denyList.contains(from)) {
			revert LibErrors.UnauthorizedCaller();
		}
		if(_denyList.contains(to)) {
			revert LibErrors.UnauthorizedReceiver();
		}
		return super.transferFrom(from, to, amount);
	}  

    // The following functions are overrides required by Solidity.

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}