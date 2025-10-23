// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title TokenA - ERC20 convencional para base de cálculo de recompensas
contract TokenA is ERC20, Ownable {
    
    constructor(uint256 initialSupply) ERC20("TokenA", "TKA") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply);
    }

    /// @notice Permite ao owner mintar mais tokens se necessário
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
