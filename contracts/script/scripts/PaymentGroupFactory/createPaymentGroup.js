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
    contractAddress: process.env.BSC_PAYMENT_GROUP_FACTORY_ADDRESS
  },
  bscTestnet: {
    name: 'BSC Testnet',
    rpc: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    chainId: 97,
    contractAddress: process.env.BSC_TESTNET_PAYMENT_GROUP_FACTORY_ADDRESS
  }
};

class PaymentGroupFactoryManager {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.abi = null;
  }

  async loadABI() {
    try {
      const abiPath = path.resolve('./abi/PaymentGroupFactory.json');
      const abiData = await fs.readFile(abiPath, 'utf8');
      const contractData = JSON.parse(abiData);
      this.abi = contractData.abi;
      console.log('✅ ABI carregado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao carregar ABI:', error.message);
      process.exit(1);
    }
  }

  async loadCreatorWallet() {
    try {
      const walletPath = path.resolve('./wallets/admin-0xb5d6B26818A777Aff58C46C297458fFa6fdd2426.keystore.json');
      const walletData = await fs.readFile(walletPath, 'utf8');
      const keystore = JSON.parse(walletData);

      const password = process.env.WALLET_PASSWORD;
      if (!password) {
        throw new Error('WALLET_PASSWORD não encontrada no arquivo .env');
      }

      this.wallet = await ethers.Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
      console.log('✅ Carteira criador carregada:', this.wallet.address);
    } catch (error) {
      console.error('❌ Erro ao carregar carteira criador:', error.message);
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

      // Get factory info
      const createdGroupsCount = await this.contract.getCreatedGroupsCount();
      console.log(`   Grupos criados: ${createdGroupsCount}`);

      return { createdGroupsCount };
    } catch (error) {
      console.error('❌ Erro ao conectar com o contrato:', error.message);
      process.exit(1);
    }
  }

  async checkCreatorRole() {
    try {
      const creatorRole = ethers.keccak256(ethers.toUtf8Bytes('CREATOR_ROLE'));
      const hasRole = await this.contract.hasRole(creatorRole, this.wallet.address);

      if (!hasRole) {
        console.error('❌ A carteira não possui role de CREATOR');
        process.exit(1);
      }

      console.log('✅ Carteira possui role de CREATOR');
    } catch (error) {
      console.error('❌ Erro ao verificar role de criador:', error.message);
      process.exit(1);
    }
  }

  async createPaymentGroup(originToken, paymentToken, admin, rewardPercentBps) {
    try {
      console.log('\n🏗️  Criando novo PaymentGroup...');
      console.log(`   Origin Token: ${originToken}`);
      console.log(`   Payment Token: ${paymentToken}`);
      console.log(`   Admin: ${admin}`);
      console.log(`   Reward %: ${(rewardPercentBps / 10000).toFixed(2)}%`);

      // Validate inputs
      if (!ethers.isAddress(originToken) || !ethers.isAddress(paymentToken) || !ethers.isAddress(admin)) {
        throw new Error('Endereços inválidos fornecidos');
      }

      if (rewardPercentBps <= 0 || rewardPercentBps > 1000000) {
        throw new Error('Percentual de recompensa deve estar entre 0.01% e 100%');
      }

      console.log('\n🚀 Executando transação...');
      const tx = await this.contract.createPaymentGroup(
        originToken,
        paymentToken,
        admin,
        rewardPercentBps
      );

      console.log(`✅ Transação enviada: ${tx.hash}`);
      console.log('⏳ Aguardando confirmação...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ PaymentGroup criado com sucesso!');

        // Parse events to get contract address
        const events = receipt.logs;
        for (const log of events) {
          try {
            const parsed = this.contract.interface.parseLog(log);
            if (parsed.name === 'PaymentGroupCreated') {
              const contractAddress = parsed.args.contractAddress;
              console.log(`   Endereço do contrato: ${contractAddress}`);
              return { receipt, contractAddress };
            }
          } catch (e) {
            // Ignore non-contract events
          }
        }

        console.log(`   Block: ${receipt.blockNumber}`);
        return { receipt };
      } else {
        throw new Error('Transação falhou');
      }
    } catch (error) {
      console.error('❌ Erro ao criar PaymentGroup:', error.message);
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
    .option('origin-token', {
      alias: 'o',
      type: 'string',
      description: 'Endereço do token de origem (ex: BBRL)',
      demandOption: true
    })
    .option('payment-token', {
      alias: 'p',
      type: 'string',
      description: 'Endereço do token de pagamento (ex: BBRL)',
      demandOption: true
    })
    .option('admin', {
      alias: 'a',
      type: 'string',
      description: 'Endereço do admin do novo grupo',
      demandOption: true
    })
    .option('reward-percent', {
      alias: 'r',
      type: 'number',
      description: 'Percentual de recompensa em basis points (10000 = 1%)',
      default: 50000 // 5%
    })
    .option('contract', {
      alias: 'c',
      type: 'string',
      description: 'Endereço do contrato PaymentGroupFactory (sobrescreve .env)'
    })
    .help()
    .alias('help', 'h')
    .example('$0 --origin-token 0x123... --payment-token 0x456... --admin 0x789...', 'Criar PaymentGroup')
    .argv;

  console.log('🏗️  PaymentGroupFactory - Criar PaymentGroup');
  console.log('===========================================\n');

  const manager = new PaymentGroupFactoryManager();

  try {
    await manager.loadABI();
    await manager.loadCreatorWallet();

    const networkConfig = await manager.setupProvider(argv.network);
    const contractAddress = argv.contract || networkConfig.contractAddress;

    if (!contractAddress) {
      console.error('❌ Endereço do contrato não encontrado');
      process.exit(1);
    }

    await manager.setupContract(contractAddress);
    await manager.checkCreatorRole();

    const result = await manager.createPaymentGroup(
      argv.originToken,
      argv.paymentToken,
      argv.admin,
      argv.rewardPercent
    );

    console.log('\n🎉 PaymentGroup criado com sucesso!');
    if (result.contractAddress) {
      console.log(`📄 Endereço do novo contrato: ${result.contractAddress}`);
    }

  } catch (error) {
    console.error('\n❌ Erro durante execução:', error.message);
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main().catch(console.error);