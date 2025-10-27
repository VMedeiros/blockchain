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

  async setupProvider(network) {
    try {
      const networkConfig = NETWORKS[network];
      if (!networkConfig) {
        throw new Error(`Rede não suportada: ${network}. Use: ${Object.keys(NETWORKS).join(', ')}`);
      }

      this.provider = new ethers.JsonRpcProvider(networkConfig.rpc);
      console.log(`✅ Conectado à rede: ${networkConfig.name} (Chain ID: ${networkInfo.chainId})`);

      return networkConfig;
    } catch (error) {
      console.error('❌ Erro ao conectar com a rede:', error.message);
      process.exit(1);
    }
  }

  async setupContract(contractAddress) {
    try {
      this.contract = new ethers.Contract(contractAddress, this.abi, this.provider);
      console.log(`✅ Contrato conectado: ${contractAddress}`);
      return {};
    } catch (error) {
      console.error('❌ Erro ao conectar com o contrato:', error.message);
      process.exit(1);
    }
  }

  async listGroups(offset = 0, limit = 10) {
    try {
      console.log('\n📋 Listando PaymentGroups criados...');

      const totalCount = await this.contract.getCreatedGroupsCount();
      console.log(`   Total de grupos: ${totalCount}`);

      if (totalCount === 0n) {
        console.log('   Nenhum grupo encontrado');
        return;
      }

      // Adjust limit if needed
      const actualLimit = Math.min(Number(limit), Number(totalCount) - Number(offset));
      if (actualLimit <= 0) {
        console.log('   Offset fora do alcance');
        return;
      }

      const groups = await this.contract.getCreatedGroups(offset, actualLimit);

      console.log(`\n   Grupos ${offset + 1} a ${offset + groups.length}:`);
      console.log('   ─────────────────────────────────────────────────────────────────────────────────');

      for (let i = 0; i < groups.length; i++) {
        const group = groups[i];
        const createdAt = new Date(Number(group.createdAt) * 1000).toISOString();
        const rewardPercent = (Number(group.rewardPercentBps) / 10000).toFixed(2);

        console.log(`   ${offset + i + 1}. ${group.contractAddress}`);
        console.log(`      Origin Token: ${group.originToken}`);
        console.log(`      Payment Token: ${group.paymentToken}`);
        console.log(`      Admin: ${group.admin}`);
        console.log(`      Reward: ${rewardPercent}%`);
        console.log(`      Criado em: ${createdAt}`);
        console.log('');
      }

      return groups;
    } catch (error) {
      console.error('❌ Erro ao listar grupos:', error.message);
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
      description: 'Endereço do contrato PaymentGroupFactory (sobrescreve .env)'
    })
    .option('offset', {
      type: 'number',
      default: 0,
      description: 'Offset para paginação'
    })
    .option('limit', {
      type: 'number',
      default: 10,
      description: 'Limite de resultados por página'
    })
    .help()
    .alias('help', 'h')
    .example('$0', 'Listar primeiros 10 grupos')
    .example('$0 --offset 10 --limit 5', 'Listar grupos 11-15')
    .argv;

  console.log('📋 PaymentGroupFactory - Listar Grupos');
  console.log('=====================================\n');

  const manager = new PaymentGroupFactoryManager();

  try {
    await manager.loadABI();

    const networkConfig = await manager.setupProvider(argv.network);
    const contractAddress = argv.contract || networkConfig.contractAddress;

    if (!contractAddress) {
      console.error('❌ Endereço do contrato não encontrado');
      process.exit(1);
    }

    await manager.setupContract(contractAddress);

    await manager.listGroups(argv.offset, argv.limit);

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