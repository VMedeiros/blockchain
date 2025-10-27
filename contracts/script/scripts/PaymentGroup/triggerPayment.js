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

      // Get contract info
      const [originToken, paymentToken, rewardPercentBps, paused] = await Promise.all([
        this.contract.originToken(),
        this.contract.paymentToken(),
        this.contract.rewardPercentBps(),
        this.contract.paused()
      ]);

      console.log(`   Origin Token: ${originToken}`);
      console.log(`   Payment Token: ${paymentToken}`);
      console.log(`   Reward %: ${(rewardPercentBps / 10000).toFixed(2)}%`);
      console.log(`   Paused: ${paused}`);

      return { originToken, paymentToken, rewardPercentBps, paused };
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

  async previewRewards() {
    try {
      console.log('\n📊 Visualizando recompensas...');

      const [accounts, rewards] = await this.contract.previewAllRewards();

      console.log(`   Participantes: ${accounts.length}`);

      if (accounts.length === 0) {
        console.log('   Nenhum participante encontrado');
        return;
      }

      console.log('\n   Recompensas previstas:');
      for (let i = 0; i < accounts.length; i++) {
        const rewardAmount = ethers.formatEther(rewards[i]);
        console.log(`   ${accounts[i]}: ${rewardAmount} tokens`);
      }

      return { accounts, rewards };
    } catch (error) {
      console.error('❌ Erro ao visualizar recompensas:', error.message);
      throw error;
    }
  }

  async triggerPayment() {
    try {
      console.log('\n💰 Disparando distribuição de pagamentos...');

      // Preview rewards first
      await this.previewRewards();

      console.log('\n🚀 Executando transação...');
      const tx = await this.contract.triggerPayment();

      console.log(`✅ Transação enviada: ${tx.hash}`);
      console.log('⏳ Aguardando confirmação...');

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        console.log('✅ Pagamentos distribuídos com sucesso!');
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas usado: ${receipt.gasUsed.toString()}`);

        // Parse events
        const events = receipt.logs;
        let rewardEvents = 0;
        for (const log of events) {
          try {
            const parsed = this.contract.interface.parseLog(log);
            if (parsed.name === 'RewardPaid') {
              rewardEvents++;
            }
          } catch (e) {
            // Ignore non-contract events
          }
        }
        console.log(`   Eventos de recompensa: ${rewardEvents}`);

        return receipt;
      } else {
        throw new Error('Transação falhou');
      }
    } catch (error) {
      console.error('❌ Erro ao disparar pagamentos:', error.message);
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
    .option('contract', {
      alias: 'c',
      type: 'string',
      description: 'Endereço do contrato PaymentGroup (sobrescreve .env)'
    })
    .option('preview-only', {
      type: 'boolean',
      default: false,
      description: 'Apenas visualizar recompensas sem executar'
    })
    .help()
    .alias('help', 'h')
    .example('$0', 'Disparar distribuição de pagamentos')
    .example('$0 --preview-only', 'Visualizar recompensas sem executar')
    .argv;

  console.log('💰 PaymentGroup - Disparar Pagamentos');
  console.log('====================================\n');

  const manager = new PaymentGroupManager();

  try {
    await manager.loadABI();
    await manager.loadOperatorWallet();

    const networkConfig = await manager.setupProvider(argv.network);
    const contractAddress = argv.contract || networkConfig.contractAddress;

    if (!contractAddress) {
      console.error('❌ Endereço do contrato não encontrado');
      process.exit(1);
    }

    await manager.setupContract(contractAddress);
    await manager.checkOperatorRole();
    await manager.checkPaused();

    if (argv.previewOnly) {
      await manager.previewRewards();
      console.log('\nℹ️  Modo preview - nenhuma transação executada');
    } else {
      await manager.triggerPayment();
      console.log('\n🎉 Distribuição de pagamentos realizada com sucesso!');
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