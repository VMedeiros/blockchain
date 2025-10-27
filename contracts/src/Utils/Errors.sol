// SPDX-License-Identifier: AGPL-3.0-or-later
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
pragma solidity ^0.8.20;

/**
 * @title Errors Library
 * @notice The Errors Library provides error messages for smart contracts.
 */
library LibErrors {
    /// Errors

    /**
     * @dev There's no code at `target` (it is not a contract).
     */
    error AddressEmptyCode(address target);

    /**
     * @dev Indicates a failure that an address is not valid.
     */
    error InvalidAddress();

    /**
     * @dev Indicates that the array length is invalid.
     * @param invalidLength The length of the given array, which is not allowed.
     */
    error InvalidArrayLength(uint256 invalidLength);

    /**
     * @dev Indicates that there was an attempt to recover tokens from an account that can participate in the system.
     * @param account The address from which token recovery was attempted.
     */
    error RecoveryOnActiveAccount(address account);

    /**
     * @dev Indicates a failure that a value is not valid.
     */
    error ZeroAmount();

    /**
     * @dev Indicates a failure because "DEFAULT_ADMIN_ROLE" was tried to be revoked.
     */
    error DefaultAdminError();

    /**
     * @dev Indicates that registry is not set.
     */
    error AccessRegistryNotSet();    

    /**
     * @dev Indicates that the lengths of the arrays do not match.
     */
    error ArrayLengthMismatch();

    /**
     * @dev Indicates that the function is disabled.
     */
    error FunctionDisabled();
   
    /**
     * @notice This error indicates that the caller is not authorized.
     * @dev Indicates that the function caller is not the authorized address.
     */
    error UnauthorizedCaller();

    /**
     * @notice This error indicates that the receiver is not authorized.
     * @dev Indicates that the function receiver is not the authorized address.
     */
    error UnauthorizedReceiver();

    /**
     * @dev Indicates that the element by such ID is not found.
     * @param id The invalid ID.
     */
    error NotFound(uint256 id);

    /**
     * @dev Indicates that the account does not have a balance to operate on.
     */
    error NoBalance();
}