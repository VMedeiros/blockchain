// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Script, console} from "forge-std/Script.sol";
import {DEMOBR} from "../contracts/src/BBRLPlus.sol";

contract DeployBBRLPlus is Script {
    address public constant DEFAULT_ADMIN = 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426;
    address public constant PAUSER = 0xeB6197375Bc88A8E6673b909F4E3B6Ee3ead8255;
    address public constant MINTER = 0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3;
    address public constant BURNER = 0x26Df3718044BEF34e7bdB9FbEf26771F5d1fa51a;
    address public constant RECOVERY = 0x8ca109d240976eAAE8D0AFc0cf61B9a1BEBD0711;
    string public constant TOKEN_NAME = "DEMO BR";
    string public constant TOKEN_SYMBOL = "DEMOBR";
    function setUp() public {}
    function run() public {
        vm.startBroadcast();
        console.log("=== INICIANDO DEPLOY DO Reward BR ===");
        // ...restante do código...
        vm.stopBroadcast();
    }
}
