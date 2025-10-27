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
    rpc: process.env.BSC_NODE_URL || 'https://bsc-dataseed.binance.org/',
    chainId: 56,
    contractAddress: process.env.BSC_PAYMENT_GROUP_ADDRESS
  },
  bscTestnet: {
    name: 'BSC Testnet',
    rpc: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    chainId: 97,
    contractAddress: process.env.BSC_TESTNET_PAYMENT_GROUP_ADDRESS
  }
};

class PaymentGroupManager {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.abi = null;
  }

  async loadABI() {
    try {
      const abiPath = path.resolve('./abi/PaymentGroup.json');
      const abiData = await fs.readFile(abiPath, 'utf8');
      const contractData = JSON.parse(abiData);
      this.abi = contractData.abi;
      console.log('✅ ABI carregado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao carregar ABI:', error.message);
      process.exit(1);
    }
  }

  async loadOperatorWallet() {
    try {
      // Use admin wallet as operator (assuming admin has operator role)
      const walletPath = path.resolve('./wallets/admin-0xb5d6B26818A777Aff58C46C297458fFa6fdd2426.keystore.json');
      const walletData = await fs.readFile(walletPath, 'utf8');
      const keystore = JSON.parse(walletData);

      const password = process.env.WALLET_PASSWORD;
      if (!password) {
        throw new Error('WALLET_PASSWORD não encontrada no arquivo .env');
      }

      this.wallet = await ethers.Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
      console.log('✅ Carteira operador carregada:', this.wallet.address);
    } catch (error) {
      console.error('❌ Erro ao carregar carteira operador:', error.message);
      process.exit(1);
    }
  }

  async setupProvider(network) {
    try {
      const networkConfig = NETWORKS[network];
      if (!networkConfig) {
        throw new Error(`Rede não suportada: ${network}. Use: ${Object.keys(NETWORKS).join(', ')}`);
      }

      this.provider = new ethers.JsonRpcProvider(networkConfig.rpc);
      this.wallet = this.wallet.connect(this.provider);

      // Verify network connection
      const networkInfo = await this.provider.getNetwork();
      console.log(`✅ Conectado à rede: ${networkConfig.name} (Chain ID: ${networkInfo.chainId})`);

      return networkConfig;
    } catch (error) {
      console.error('❌ Erro ao conectar com a rede:', error.message);
      process.exit(1);
    }
  }

  async setupContract(contractAddress) {
    try {
      this.contract = new ethers.Contract(contractAddress, this.abi, this.wallet);

      console.log(`✅ Contrato conectado: ${contractAddress}`);

      return {};
    } catch (error) {
      console.error('❌ Erro ao conectar com o contrato:', error.message);
      process.exit(1);
    }
  }

  async checkOperatorRole() {
    try {
      const operatorRole = ethers.keccak256(ethers.toUtf8Bytes('OPERATOR_ROLE'));
      const hasRole = await this.contract.hasRole(operatorRole, this.wallet.address);

      if (!hasRole) {
        console.error('❌ A carteira não possui role de OPERATOR');
        console.error(`   Carteira: ${this.wallet.address}`);
        process.exit(1);
      }

      console.log('✅ Carteira possui role de OPERATOR');
    } catch (error) {
      console.error('❌ Erro ao verificar role de operador:', error.message);
      process.exit(1);
    }
  }

  async checkPaused() {
    try {
      const isPaused = await this.contract.paused();
      if (isPaused) {
        console.error('❌ Contrato está pausado');
        process.exit(1);
      }
      console.log('✅ Contrato não está pausado');
    } catch (error) {
      console.error('❌ Erro ao verificar status do contrato:', error.message);
      process.exit(1);
    }
  }

  async addParticipant(account) {
    try {
      console.log('\n📝 Adicionando participante...');
      console.log(`   Conta: ${account}`);

      // Check if already participant
      const participants = await this.contract.getParticipants();
      if (participants.includes(account)) {
        console.log('ℹ️  Conta já é participante');
        return;
      }

      console.log('\n🚀 Executando transação...');
      const tx = await this.contract.addParticipant(account);

      console.log(`✅ Transação enviada: ${tx.hash}`);
      console.log('⏳ Aguardando confirmação...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ Participante adicionado com sucesso!');
        console.log(`   Block: ${receipt.blockNumber}`);
        return receipt;
      } else {
        throw new Error('Transação falhou');
      }
    } catch (error) {
      console.error('❌ Erro ao adicionar participante:', error.message);
      throw error;
    }
  }
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .usage('Uso: $0 [opções]')
    .option('network', {
      alias: 'n',
      type: 'string',
      default: 'bsc',
      description: 'Rede blockchain',
      choices: Object.keys(NETWORKS)
    })
    .option('account', {
      alias: 'a',
      type: 'string',
      description: 'Endereço da conta a adicionar como participante',
      demandOption: true
    })
    .option('contract', {
      alias: 'c',
      type: 'string',
      description: 'Endereço do contrato PaymentGroup (sobrescreve .env)'
    })
    .help()
    .alias('help', 'h')
    .example('$0 --account 0x123...', 'Adicionar participante')
    .argv;

  console.log('👥 PaymentGroup - Adicionar Participante');
  console.log('=======================================\n');

  const manager = new PaymentGroupManager();

  try {
    // Load ABI and wallet
    await manager.loadABI();
    await manager.loadOperatorWallet();

    // Setup network and contract
    const networkConfig = await manager.setupProvider(argv.network);
    const contractAddress = argv.contract || networkConfig.contractAddress;

    if (!contractAddress) {
      console.error('❌ Endereço do contrato não encontrado');
      console.error('Configure BSC_PAYMENT_GROUP_ADDRESS no .env ou use --contract');
      process.exit(1);
    }

    await manager.setupContract(contractAddress);

    // Check permissions and status
    await manager.checkOperatorRole();
    await manager.checkPaused();

    // Validate address
    if (!ethers.isAddress(argv.account)) {
      console.error('❌ Endereço inválido:', argv.account);
      process.exit(1);
    }

    // Add participant
    await manager.addParticipant(argv.account);
    console.log('\n🎉 Participante adicionado com sucesso!');

  } catch (error) {
    console.error('\n❌ Erro durante execução:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run main function
main().catch(console.error);