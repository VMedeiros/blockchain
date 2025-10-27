#!/usr/bin/env node

import { ethers } from 'ethers';
import fs from 'fs/promises';
import path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Contract addresses and network configurations
const NETWORKS = {
  bsc: {
    name: 'Binance Smart Chain',
    rpc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
    chainId: 56
  },
  bscTestnet: {
    name: 'BSC Testnet', 
    rpc: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    chainId: 97
  }
};

// Role constants from the contract
const ROLES = {
  DEFAULT_ADMIN_ROLE: '0x0000000000000000000000000000000000000000000000000000000000000000',
  PAUSER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('PAUSER_ROLE')),
  MINTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE')),
  BURNER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE')),
  RECOVERY_ROLE: ethers.keccak256(ethers.toUtf8Bytes('RECOVERY_ROLE'))
};

const ROLE_NAMES = {
  [ROLES.DEFAULT_ADMIN_ROLE]: 'DEFAULT_ADMIN_ROLE',
  [ROLES.PAUSER_ROLE]: 'PAUSER_ROLE',
  [ROLES.MINTER_ROLE]: 'MINTER_ROLE',
  [ROLES.BURNER_ROLE]: 'BURNER_ROLE',
  [ROLES.RECOVERY_ROLE]: 'RECOVERY_ROLE'
};

class RoleChecker {
  constructor() {
    this.provider = null;
    this.contract = null;
    this.abi = null;
  }

  async loadABI() {
    try {
      const abiPath = path.resolve('./abi/BBRLPlus.json');
      const abiData = await fs.readFile(abiPath, 'utf8');
      this.abi = JSON.parse(abiData);
      console.log('✅ ABI carregado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao carregar ABI:', error.message);
      process.exit(1);
    }
  }

  async setupProvider(network) {
    try {
      const networkConfig = NETWORKS[network];
      if (!networkConfig) {
        throw new Error(`Rede não suportada: ${network}`);
      }

      this.provider = new ethers.JsonRpcProvider(networkConfig.rpc);
      await this.provider.getNetwork();
      console.log(`✅ Conectado à rede: ${networkConfig.name}`);
    } catch (error) {
      console.error('❌ Erro ao conectar com a rede:', error.message);
      process.exit(1);
    }
  }

  async setupContract(contractAddress) {
    try {
      this.contract = new ethers.Contract(contractAddress, this.abi, this.provider);
      
      // Verify contract exists by calling a view function
      await this.contract.symbol();
      console.log(`✅ Contrato conectado: ${contractAddress}`);
    } catch (error) {
      console.error('❌ Erro ao conectar com o contrato:', error.message);
      console.error('Verifique se o endereço do contrato está correto');
      process.exit(1);
    }
  }

  async checkRole(walletAddress, roleHash) {
    try {
      const hasRole = await this.contract.hasRole(roleHash, walletAddress);
      return hasRole;
    } catch (error) {
      console.error(`❌ Erro ao verificar role:`, error.message);
      return false;
    }
  }

  async checkAllRoles(walletAddress) {
    console.log(`\n🔍 Verificando roles para o endereço: ${walletAddress}\n`);
    
    const results = {};
    
    for (const [roleHash, roleName] of Object.entries(ROLE_NAMES)) {
      try {
        const hasRole = await this.checkRole(walletAddress, roleHash);
        results[roleName] = hasRole;
        
        const status = hasRole ? '✅ TEM' : '❌ NÃO TEM';
        console.log(`${status} ${roleName}`);
      } catch (error) {
        console.error(`❌ Erro ao verificar ${roleName}:`, error.message);
        results[roleName] = false;
      }
    }

    return results;
  }

  async checkSpecificRole(walletAddress, roleName) {
    const roleHash = Object.keys(ROLE_NAMES).find(
      key => ROLE_NAMES[key] === roleName.toUpperCase()
    );

    if (!roleHash) {
      console.error(`❌ Role inválida: ${roleName}`);
      console.log('Roles disponíveis:', Object.values(ROLE_NAMES).join(', '));
      return false;
    }

    console.log(`\n🔍 Verificando ${roleName.toUpperCase()} para: ${walletAddress}`);
    
    const hasRole = await this.checkRole(walletAddress, roleHash);
    const status = hasRole ? '✅ TEM' : '❌ NÃO TEM';
    console.log(`${status} ${roleName.toUpperCase()}`);
    
    return hasRole;
  }

  displayHelp() {
    console.log(`
🔐 Role Checker - BBRLPlus Contract

Uso:
  node scripts/roleChecker.js --wallet <WALLET_ADDRESS> --contract <CONTRACT_ADDRESS> --network <NETWORK> [--role <ROLE_NAME>]

Parâmetros:
  --wallet, -w     Endereço da wallet a ser verificada (obrigatório)
  --contract, -c   Endereço do contrato BBRLPlus (obrigatório)
  --network, -n    Rede blockchain (bsc, bscTestnet) (obrigatório)
  --role, -r       Role específica para verificar (opcional)
  --help, -h       Mostra esta mensagem de ajuda

Roles disponíveis:
  - DEFAULT_ADMIN_ROLE
  - PAUSER_ROLE
  - MINTER_ROLE
  - BURNER_ROLE
  - RECOVERY_ROLE

Exemplos:
  # Verificar todas as roles
  node scripts/roleChecker.js -w 0x123... -c 0xabc... -n bscTestnet

  # Verificar role específica
  node scripts/roleChecker.js -w 0x123... -c 0xabc... -n bscTestnet -r MINTER_ROLE

Variáveis de ambiente (opcionais):
  BSC_RPC_URL          - URL RPC personalizada para BSC
  BSC_TESTNET_RPC_URL  - URL RPC personalizada para BSC Testnet
    `);
  }
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('wallet', {
      alias: 'w',
      type: 'string',
      description: 'Endereço da wallet'
    })
    .option('contract', {
      alias: 'c', 
      type: 'string',
      description: 'Endereço do contrato'
    })
    .option('network', {
      alias: 'n',
      type: 'string',
      choices: ['bsc', 'bscTestnet'],
      description: 'Rede blockchain'
    })
    .option('role', {
      alias: 'r',
      type: 'string',
      description: 'Role específica para verificar'
    })
    .option('help', {
      alias: 'h',
      type: 'boolean',
      description: 'Mostra ajuda'
    })
    .argv;

  const roleChecker = new RoleChecker();

  if (argv.help) {
    roleChecker.displayHelp();
    return;
  }

  // Validate required parameters
  if (!argv.wallet || !argv.contract || !argv.network) {
    console.error('❌ Parâmetros obrigatórios faltando!');
    roleChecker.displayHelp();
    process.exit(1);
  }

  // Validate wallet address
  if (!ethers.isAddress(argv.wallet)) {
    console.error('❌ Endereço da wallet inválido');
    process.exit(1);
  }

  // Validate contract address
  if (!ethers.isAddress(argv.contract)) {
    console.error('❌ Endereço do contrato inválido');
    process.exit(1);
  }

  try {
    console.log('🚀 Iniciando verificação de roles...\n');

    // Setup
    await roleChecker.loadABI();
    await roleChecker.setupProvider(argv.network);
    await roleChecker.setupContract(argv.contract);

    // Check roles
    if (argv.role) {
      await roleChecker.checkSpecificRole(argv.wallet, argv.role);
    } else {
      const results = await roleChecker.checkAllRoles(argv.wallet);
      
      // Summary
      const hasAnyRole = Object.values(results).some(hasRole => hasRole);
      console.log(`\n📊 Resumo:`);
      console.log(`Endereço: ${argv.wallet}`);
      console.log(`Possui alguma role: ${hasAnyRole ? '✅ SIM' : '❌ NÃO'}`);
      
      const rolesCount = Object.values(results).filter(hasRole => hasRole).length;
      console.log(`Total de roles: ${rolesCount}/${Object.keys(results).length}`);
    }

    console.log('\n✅ Verificação concluída!');

  } catch (error) {
    console.error('❌ Erro durante a execução:', error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default RoleChecker;
