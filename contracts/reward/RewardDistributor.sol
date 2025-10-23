// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IMintableERC20.sol";

/**
 * @title RewardDistributor
 * @notice Distribui recompensas em TokenB baseadas em um percentual do saldo de TokenA
 *         das carteiras registradas. Disparo manual (operador) ou automático por intervalo de blocos.
 */
contract RewardDistributor is AccessControl {
    using EnumerableSet for EnumerableSet.AddressSet;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    IERC20 public tokenA; // configurável após deploy
    IMintableERC20 public tokenB; // configurável após deploy

    // Percentual em basis points (10000 = 100%)
    uint16 public rewardPercentBps;

    // Intervalo de blocos para trigger automático
    uint256 public blockInterval;
    uint256 public lastTriggerBlock;

    // Limite máximo de participantes
    uint256 public maxParticipants;

    EnumerableSet.AddressSet private participants;

    event ParticipantAdded(address indexed account);
    event ParticipantRemoved(address indexed account);
    event RewardTriggered(uint256 blockNumber, uint256 percentBps, uint256 participantsCount);
    event RewardPaid(address indexed account, uint256 balanceA, uint256 rewardAmount, uint16 percentBps);
    event PercentUpdated(uint16 oldValue, uint16 newValue);
    event BlockIntervalUpdated(uint256 oldValue, uint256 newValue);
    event MaxParticipantsUpdated(uint256 oldValue, uint256 newValue);
    event Paused(address indexed by);
    event Unpaused(address indexed by);

    constructor(
        address _tokenA,
        address _tokenB,
        uint16 _rewardPercentBps,
        uint256 _blockInterval
    ) {
        require(_rewardPercentBps <= 10000, "Percent > 100%" );
        if (_tokenA != address(0) && _tokenB != address(0)) {
            tokenA = IERC20(_tokenA);
            tokenB = IMintableERC20(_tokenB);
        }
        rewardPercentBps = _rewardPercentBps;
        blockInterval = _blockInterval;
        lastTriggerBlock = block.number;
        maxParticipants = 1000; // padrão

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    event TokensConfigured(address tokenA, address tokenB);

    /// @notice Permite configurar ou reconfigurar os tokens (apenas admin) se ainda não definidos
    function setTokens(address _tokenA, address _tokenB) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_tokenA != address(0) && _tokenB != address(0), "Zero address");
        tokenA = IERC20(_tokenA);
        tokenB = IMintableERC20(_tokenB);
        emit TokensConfigured(_tokenA, _tokenB);
    }

    // -------------------- Admin / Config --------------------
    function setRewardPercentBps(uint16 newPercent) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newPercent <= 10000, ">100%" );
        require(newPercent > 0, "Percent = 0");
        emit PercentUpdated(rewardPercentBps, newPercent);
        rewardPercentBps = newPercent;
    }

    function setBlockInterval(uint256 newInterval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newInterval > 0, "Interval = 0");
        emit BlockIntervalUpdated(blockInterval, newInterval);
        blockInterval = newInterval;
    }

    function setMaxParticipants(uint256 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMax >= participants.length(), "Below current count");
        emit MaxParticipantsUpdated(maxParticipants, newMax);
        maxParticipants = newMax;
    }

    bool private _paused;

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _paused = true; emit Paused(msg.sender);}    
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _paused = false; emit Unpaused(msg.sender);}    
    function paused() public view returns (bool) { return _paused; }

    function grantOperator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(OPERATOR_ROLE, account);
    }

    // -------------------- Participants --------------------
    function addParticipant(address account) external onlyRole(OPERATOR_ROLE) {
        require(!_paused, "Paused");
        require(account != address(0), "Zero address");
        require(participants.length() < maxParticipants, "Max participants reached");
        require(participants.add(account), "Already added");
        emit ParticipantAdded(account);
    }

    function removeParticipant(address account) external onlyRole(OPERATOR_ROLE) {
        require(!_paused, "Paused");
        require(participants.remove(account), "Not participant");
        emit ParticipantRemoved(account);
    }

    function getParticipants() external view returns (address[] memory list) {
        list = participants.values();
    }

    function participantsCount() external view returns (uint256) { return participants.length(); }
    function getParticipantsCount() external view returns (uint256) { return participants.length(); }

    // -------------------- Reward Logic --------------------
    function triggerManual() external onlyRole(OPERATOR_ROLE) {
        require(!_paused, "Paused");
        _distribute();
    }

    // Alias solicitado: manualTrigger
    function manualTrigger() external onlyRole(OPERATOR_ROLE) { require(!_paused, "Paused"); _distribute(); }


    function triggerIfInterval() external {
        require(!_paused, "Paused");
        require(block.number >= lastTriggerBlock + blockInterval, "Interval not reached");
        _distribute();
    }

    // Alias solicitado: autoTrigger
    function autoTrigger() external { 
        require(!_paused, "Paused");
        require(block.number >= lastTriggerBlock + blockInterval, "Interval not reached");
        _distribute();
    }

    function canTrigger() external view returns (bool) {
        return block.number >= lastTriggerBlock + blockInterval;
    }

    function nextTriggerBlock() external view returns (uint256) {
        return lastTriggerBlock + blockInterval;
    }

    /// @notice Calcula quanto de TokenB seria mintado para um usuário agora, sem executar.
    function previewUserReward(address user) public view returns (uint256 balanceA, uint256 rewardAmount) {
        balanceA = tokenA.balanceOf(user);
        if (balanceA == 0) return (0, 0);
        rewardAmount = (balanceA * rewardPercentBps) / 10000;
    }

    /// @notice Retorna arrays paralelos com participantes e recompensas potenciais (custo de gas proporcional ao número de participantes).
    function previewAllRewards() external view returns (address[] memory accounts, uint256[] memory rewards) {
        uint256 len = participants.length();
        accounts = new address[](len);
        rewards = new uint256[](len);
        uint16 percent = rewardPercentBps;
        for (uint256 i = 0; i < len; i++) {
            address user = participants.at(i);
            accounts[i] = user;
            uint256 balanceA = tokenA.balanceOf(user);
            if (balanceA == 0) {
                rewards[i] = 0;
            } else {
                rewards[i] = (balanceA * percent) / 10000;
            }
        }
    }

    function _distribute() internal {
        // Garante que não ocorre duas distribuições seguidas sem avanço de bloco
        require(block.number > lastTriggerBlock, "Already distributed this block");
        lastTriggerBlock = block.number;
        uint256 len = participants.length();
        uint16 percent = rewardPercentBps;
        for (uint256 i = 0; i < len; i++) {
            address user = participants.at(i);
            uint256 balanceA = tokenA.balanceOf(user);
            if (balanceA == 0) continue;
            uint256 rewardAmount = (balanceA * percent) / 10000;
            if (rewardAmount > 0) {
                tokenB.mint(user, rewardAmount);
                emit RewardPaid(user, balanceA, rewardAmount, percent);
            }
        }
        emit RewardTriggered(block.number, percent, len);
    }
}
