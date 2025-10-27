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
    contractAddress: process.env.BSC_CONTRACT_ADDRESS
  },
  bscTestnet: {
    name: 'BSC Testnet', 
    rpc: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    chainId: 97,
    contractAddress: process.env.BSC_TESTNET_CONTRACT_ADDRESS
  }
};

class TokenMinter {
  constructor() {
    this.provider = null;
    this.wallet = null;
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

  async loadMinterWallet() {
    try {
      const walletPath = path.resolve('./wallets/minter-0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3.keystore.json');
      const walletData = await fs.readFile(walletPath, 'utf8');
      const keystore = JSON.parse(walletData);
      
      const password = process.env.WALLET_PASSWORD;
      if (!password) {
        throw new Error('WALLET_PASSWORD não encontrada no arquivo .env');
      }

      this.wallet = await ethers.Wallet.fromEncryptedJson(JSON.stringify(keystore), password);
      console.log('✅ Carteira minter carregada:', this.wallet.address);
    } catch (error) {
      console.error('❌ Erro ao carregar carteira minter:', error.message);
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
      
      // Verify contract exists and get basic info
      const [name, symbol, decimals] = await Promise.all([
        this.contract.name(),
        this.contract.symbol(),
        this.contract.decimals()
      ]);
      
      console.log(`✅ Contrato conectado: ${contractAddress}`);
      console.log(`   Token: ${name} (${symbol})`);
      console.log(`   Decimais: ${decimals}`);
      
      return { name, symbol, decimals };
    } catch (error) {
      console.error('❌ Erro ao conectar com o contrato:', error.message);
      console.error('Verifique se o endereço do contrato está correto');
      process.exit(1);
    }
  }

  async checkMinterRole() {
    try {
      const minterRole = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
      const hasRole = await this.contract.hasRole(minterRole, this.wallet.address);
      
      if (!hasRole) {
        console.error('❌ A carteira não possui role de MINTER');
        console.error(`   Carteira: ${this.wallet.address}`);
        console.error('   Verifique se a carteira tem permissão para mintar tokens');
        process.exit(1);
      }
      
      console.log('✅ Carteira possui role de MINTER');
    } catch (error) {
      console.error('❌ Erro ao verificar role de minter:', error.message);
      process.exit(1);
    }
  }

  async getWalletBalance() {
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error('❌ Erro ao obter saldo da carteira:', error.message);
      return '0';
    }
  }

  async estimateGas(to, amount, ref) {
    try {
      const gasEstimate = await this.contract.mintRef.estimateGas(to, amount, ref);
      return gasEstimate;
    } catch (error) {
      console.error('❌ Erro ao estimar gas:', error.message);
      throw error;
    }
  }

  async mintTokens(to, amount, ref, gasLimit = null) {
    try {
      console.log('\n📝 Preparando transação de mint...');
      console.log(`   Para: ${to}`);
      console.log(`   Quantidade: ${ethers.formatEther(amount)} tokens`);
      console.log(`   Referência: ${ref}`);
      
      // Check wallet balance
      const walletBalance = await this.getWalletBalance();
      console.log(`   Saldo da carteira: ${walletBalance} BNB`);
      
      // Estimate gas if not provided
      if (!gasLimit) {
        console.log('\n⏳ Estimando gas...');
        gasLimit = await this.estimateGas(to, amount, ref);
        // Add 20% buffer to gas estimate
        gasLimit = gasLimit * 120n / 100n;
      }
      
      console.log(`   Gas estimado: ${gasLimit.toString()}`);
      
      // Execute mint transaction
      console.log('\n🚀 Executando transação de mint...');
      const tx = await this.contract.mintRef(to, amount, ref, {
        gasLimit: gasLimit
      });
      
      console.log(`✅ Transação enviada: ${tx.hash}`);
      console.log('⏳ Aguardando confirmação...');
      
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        console.log('✅ Transação confirmada!');
        console.log(`   Block: ${receipt.blockNumber}`);
        console.log(`   Gas usado: ${receipt.gasUsed.toString()}`);
        console.log(`   Taxa de gas: ${ethers.formatEther(receipt.gasUsed * receipt.gasPrice)} BNB`);
        
        // Parse events to show minted amount
        const events = receipt.logs;
        console.log(`   Eventos emitidos: ${events.length}`);
        
        return receipt;
      } else {
        throw new Error('Transação falhou');
      }
    } catch (error) {
      console.error('❌ Erro ao mintar tokens:', error.message);
      throw error;
    }
  }

  parseAmount(amountStr, decimals) {
    try {
      // If amount contains decimal point, treat as token amount
      // Otherwise treat as raw amount (wei)
      if (amountStr.includes('.')) {
        return ethers.parseUnits(amountStr, decimals);
      } else {
        // Check if it's a large number (assume wei) or small number (assume tokens)
        const num = parseFloat(amountStr);
        if (num > 1000000) {
          // Assume it's already in wei
          return BigInt(amountStr);
        } else {
          // Assume it's token amount
          return ethers.parseUnits(amountStr, decimals);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao parsear quantidade:', error.message);
      console.error('Use formato: "100.5" para tokens ou "100500000000000000000" para wei');
      process.exit(1);
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
    .option('to', {
      alias: 't',
      type: 'string',
      description: 'Endereço de destino para mint',
      demandOption: true
    })
    .option('amount', {
      alias: 'a',
      type: 'string',
      description: 'Quantidade de tokens a mintar (ex: "100.5" ou "100500000000000000000")',
      demandOption: true
    })
    .option('ref', {
      alias: 'r',
      type: 'string',
      description: 'Referência para o mint',
      default: `mint-${Date.now()}`
    })
    .option('contract', {
      alias: 'c',
      type: 'string',
      description: 'Endereço do contrato (sobrescreve .env)'
    })
    .option('gas-limit', {
      alias: 'g',
      type: 'string',
      description: 'Limite de gas personalizado'
    })
    .option('dry-run', {
      type: 'boolean',
      default: false,
      description: 'Simular transação sem executar'
    })
    .help()
    .alias('help', 'h')
    .example('$0 --to 0x123... --amount 100.5', 'Mintar 100.5 tokens')
    .example('$0 --to 0x123... --amount 1000 --ref "mint-campaign-1"', 'Mintar com referência')
    .example('$0 --network bscTestnet --to 0x123... --amount 50', 'Mintar na testnet')
    .argv;

  console.log('🪙 AuthBank Token Minter');
  console.log('========================\n');

  const minter = new TokenMinter();

  try {
    // Load ABI and wallet
    await minter.loadABI();
    await minter.loadMinterWallet();

    // Setup network and contract
    const networkConfig = await minter.setupProvider(argv.network);
    const contractAddress = argv.contract || networkConfig.contractAddress;
    
    if (!contractAddress) {
      console.error('❌ Endereço do contrato não encontrado');
      console.error('Configure BSC_CONTRACT_ADDRESS no .env ou use --contract');
      process.exit(1);
    }

    const tokenInfo = await minter.setupContract(contractAddress);
    
    // Check minter permissions
    await minter.checkMinterRole();

    // Parse amount
    const amount = minter.parseAmount(argv.amount, tokenInfo.decimals);
    console.log(`\n💰 Quantidade parseada: ${ethers.formatUnits(amount, tokenInfo.decimals)} ${tokenInfo.symbol}`);

    // Validate destination address
    if (!ethers.isAddress(argv.to)) {
      console.error('❌ Endereço de destino inválido:', argv.to);
      process.exit(1);
    }

    // Parse gas limit if provided
    let gasLimit = null;
    if (argv.gasLimit) {
      gasLimit = BigInt(argv.gasLimit);
    }

    if (argv.dryRun) {
      console.log('\n🧪 Modo dry-run - simulando transação...');
      try {
        await minter.estimateGas(argv.to, amount, argv.ref);
        console.log('✅ Simulação bem-sucedida - transação seria executada com sucesso');
      } catch (error) {
        console.error('❌ Simulação falhou:', error.message);
        process.exit(1);
      }
    } else {
      // Execute mint
      await minter.mintTokens(argv.to, amount, argv.ref, gasLimit);
      console.log('\n🎉 Mint realizado com sucesso!');
    }

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
