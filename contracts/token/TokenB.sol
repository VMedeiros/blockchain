// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TokenB - ERC20 de recompensas
/// @notice Simples token de recompensa: somente o owner pode mintar. Owner será transferido para o contrato Reward.
///         Pausável para emergências (pausa bloqueia transferências e mint por herança de ERC20Pausable).
contract TokenB is ERC20Pausable, Ownable {
    constructor() ERC20("TokenB", "TKB") Ownable(msg.sender) {}

    /// @notice Mint restrito ao owner (contrato Reward após transferOwnership)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Pausa operações de transferência/mint
    function pause() external onlyOwner { _pause(); }
    /// @notice Retoma operações
    function unpause() external onlyOwner { _unpause(); }
}
