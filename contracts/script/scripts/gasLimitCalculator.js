/**
 * Gas Limit Calculator for BBRLPlus Contract
 * 
 * Este script utiliza os métodos recomendados do Ethers.js v5 para estimativa de gas:
 * 
 * 1. contract.callStatic.methodName() - Pré-verificação para validar se a transação pode ser executada
 * 2. contract.estimateGas.methodName() - Método principal para estimativa de gas (recomendado)
 * 3. contract.populateTransaction.methodName() + provider.estimateGas() - Método alternativo
 * 4. Estimativa baseada em padrões típicos - Fallback final
 * 
 * Referência: https://docs.ethers.org/v5/api/contract/example/#erc20-meta-methods
 * 
 * @author AuthBank Team
 * @version 2.0.0 - Atualizado com padrões Ethers.js v5
 */

import { ethers } from 'ethers';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
dotenv.config();

// Obter o diretório atual para resolver o caminho do ABI
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar o ABI completo do arquivo JSON
const abiPath = path.join(__dirname, '..', 'abi', 'BBRLPlus.json');
const BBRL_PLUS_ABI = JSON.parse(fs.readFileSync(abiPath, 'utf8'));

async function estimateGasForMintRef() {
    try {
        // Configurar provider usando BSC_NODE_URL do .env
        const provider = new ethers.JsonRpcProvider(process.env.BSC_NODE_URL);

        // Endereço do contrato do .env
        const contractAddress = process.env.BSC_CONTRACT_ADDRESS;

        // Tentar carregar wallet minter (opcional)
        let contract;

        const minterKeystorePath = './wallets/minter-0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3.keystore.json';
        const keystoreJson = fs.readFileSync(minterKeystorePath, 'utf8');
        const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, process.env.WALLET_PASSWORD);
        const connectedWallet = wallet.connect(provider);
        console.log(connectedWallet.address, "🔑 Wallet minter carregada");

        // Criar instância do contrato conectada com a wallet minter        
        contract = new ethers.Contract(contractAddress, BBRL_PLUS_ABI, connectedWallet);
        console.log("🔐 Contrato conectado com a wallet minter");


        // Parâmetros de exemplo para estimativa
        const sampleParams = {
            to: "0x1cc0fa6105f1d74E0D8fa57b3D83201F4712a071", // Endereço de exemplo
            amount: ethers.parseUnits("1000", 18), // 1000 tokens (assumindo 18 decimais)
            ref: "GAS_ESTIMATION_TEST" // Referência de teste
        };      

        console.log("🔗 Conectando à BSC...");
        console.log(`📋 Contrato: ${contractAddress}`);
        console.log(`🌐 RPC: ${process.env.BSC_NODE_URL}`);
        console.log("");

        console.log("⚙️  Parâmetros para estimativa:");
        console.log(`   to: ${sampleParams.to}`);
        console.log(`   amount: ${ethers.formatUnits(sampleParams.amount, 18)} tokens`);
        console.log(`   ref: "${sampleParams.ref}"`);
        console.log("");

        // Verificar se o contrato existe e tem as funções básicas
        console.log("🔍 Verificando contrato...");
        try {
            const [name, symbol, decimals] = await Promise.all([
                contract.name(),
                contract.symbol(), 
                contract.decimals()
            ]);
            console.log(`✅ Contrato válido: ${name} (${symbol}) - ${decimals} decimais`);
        } catch (contractError) {
            console.error('❌ Erro ao verificar contrato:', contractError.message);
            console.error('💡 O contrato pode não estar implantado no endereço especificado');
            throw contractError;
        }

        // Verificar se a carteira tem role de minter
        console.log("🔐 Verificando permissões...");
        try {
            const minterRole = ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE'));
            const hasRole = await contract.hasRole(minterRole, connectedWallet.address);
            
            if (!hasRole) {
                console.error('❌ A carteira não possui role de MINTER');
                console.error(`   Carteira: ${connectedWallet.address}`);
                throw new Error('Wallet não possui permissão MINTER_ROLE');
            }
            
            console.log('✅ Carteira possui role de MINTER');
        } catch (roleError) {
            console.error('❌ Erro ao verificar role de minter:', roleError.message);
            throw roleError;
        }

        // Verificar se o contrato está pausado
        console.log("⏸️  Verificando se o contrato está pausado...");
        try {
            const isPaused = await contract.paused();
            if (isPaused) {
                console.error('❌ O contrato está pausado');
                throw new Error('Contrato está pausado, não é possível mintar tokens');
            }
            console.log('✅ Contrato não está pausado');
        } catch (pauseError) {
            if (pauseError.message.includes('pausado')) {
                throw pauseError;
            }
            console.log('⚠️  Não foi possível verificar se o contrato está pausado (função pode não existir)');
        }

        // Estimar gas para o método mintRef
        console.log("⏳ Estimando gas...");

        // Primeiro, validar se a transação pode ser executada (pre-flight check)
        let gasEstimate;
        try {
            gasEstimate = await contract.mintRef.estimateGas(sampleParams.to, sampleParams.amount, sampleParams.ref);
        } catch (error) {
            console.error('❌ Erro ao estimar gas:', error.message);
            
            // Adicionar mais detalhes sobre o erro
            if (error.code === 'BUFFER_OVERRUN') {
                console.error('💡 Este erro pode indicar que:');
                console.error('   - A função mintRef não existe no contrato');
                console.error('   - O contrato está pausado');
                console.error('   - Há problemas com os parâmetros fornecidos');
                console.error('   - O endereço de destino é inválido');
            }
            
            throw error;
        }

        console.log("✅ Estimativa concluída!");
        console.log("");
        console.log("📊 Resultados:");
        console.log(`   Estimated Gas: ${gasEstimate.toString()}`);
        console.log(`   Gas Limit Recomendado: ${(gasEstimate * 120n / 100n).toString()} (com 20% buffer)`);
        console.log(`   Gas Limit Conservador: ${(gasEstimate * 150n / 100n).toString()} (com 50% buffer)`);

        // Adicionar informações sobre custos estimados em BNB
        try {
            let gasPrice;
            let gasPriceSource = "network";

            try {
                gasPrice = await provider.getGasPrice();
                console.log(`\n📡 Gas price obtido da rede: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
            } catch (gasPriceError) {
                // Fallback: usar gas price típico da BSC (5 Gwei)
                gasPrice = ethers.parseUnits("5", "gwei");
                gasPriceSource = "fallback";
                console.log(`\n💡 Usando gas price padrão da BSC: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
            }

            const costInWei = gasEstimate * gasPrice;
            const costInBNB = ethers.formatEther(costInWei);
            const costWithBufferInWei = (gasEstimate * 120n / 100n) * gasPrice;
            const costWithBufferInBNB = ethers.formatEther(costWithBufferInWei);
            const costConservativeInWei = (gasEstimate * 150n / 100n) * gasPrice;
            const costConservativeInBNB = ethers.formatEther(costConservativeInWei);

            console.log("");
            console.log("💰 Custo Estimado:");
            console.log(`   Gas Price (${gasPriceSource}): ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
            console.log(`   Custo Base: ~${parseFloat(costInBNB).toFixed(6)} BNB`);
            console.log(`   Custo c/ Buffer 20%: ~${parseFloat(costWithBufferInBNB).toFixed(6)} BNB`);
            console.log(`   Custo Conservador 50%: ~${parseFloat(costConservativeInBNB).toFixed(6)} BNB`);

           
        } catch (error) {
            console.log(`\n⚠️  Erro ao calcular custos estimados: ${error.message}`);
        }

        // Preparar resultado estruturado para retorno
        const gasEstimationResult = {
            success: true,
            estimatedGas: gasEstimate.toString(),
            recommendedGasLimit: (gasEstimate * 120n / 100n).toString(),
            conservativeGasLimit: (gasEstimate * 150n / 100n).toString(),
            canExecute: true, // Se chegou até aqui, a transação pode ser executada
            timestamp: new Date().toISOString(),
            method: 'mintRef',
            parameters: {
                to: sampleParams.to,
                amount: ethers.formatUnits(sampleParams.amount, 18),
                ref: sampleParams.ref
            }
        };

        return gasEstimationResult;

    } catch (error) {
        console.error("❌ Erro ao estimar gas:", error.message);

        // Tratamento específico de erros baseado nos tipos do Ethers.js v5
        if (error.code === 'NETWORK_ERROR' || error.message.includes("could not detect network")) {
            console.error("🌐 Erro de rede detectado");
            console.error("💡 Verifique se BSC_NODE_URL está correto no arquivo .env");
            console.error("💡 Verifique sua conexão com a internet");
        } else if (error.code === 'INVALID_ARGUMENT' || error.message.includes("invalid address")) {
            console.error("📝 Argumento inválido detectado");
            console.error("💡 Verifique se BSC_CONTRACT_ADDRESS está correto no arquivo .env");
            console.error("💡 Verifique se os endereços têm o formato correto (checksum)");
        } else if (error.code === 'CALL_EXCEPTION') {
            console.error("🔧 Erro na chamada do contrato");
            console.error(`💡 Razão: ${error.reason || 'Não especificada'}`);
            console.error("💡 O contrato pode não estar implantado no endereço especificado");
            console.error("💡 Ou a função mintRef pode não existir com os parâmetros fornecidos");
        } else if (error.code === 'INSUFFICIENT_FUNDS') {
            console.error("💰 Fundos insuficientes");
            console.error("💡 A wallet não tem BNB suficiente para executar a transação");
        } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            console.error("⚡ Não foi possível prever o limite de gas");
            console.error("💡 A transação pode falhar por razões de lógica de negócio");
            console.error("💡 Verifique se a wallet tem permissão MINTER_ROLE");
        } else {
            console.error("❓ Erro não categorizado");
            console.error(`💡 Código do erro: ${error.code || 'N/A'}`);
            console.error(`💡 Dados adicionais: ${error.data || 'N/A'}`);
        }

        console.error("\n🔍 Para mais detalhes, execute com variável de ambiente DEBUG=ethers*");
        console.error("   Exemplo: DEBUG=ethers* node gasLimitCalculator.js");

        process.exit(1);
    }
}

async function estimateGasForTransferWithRef() {
    try {
        // Configurar provider usando BSC_NODE_URL do .env
        const provider = new ethers.JsonRpcProvider(process.env.BSC_NODE_URL);

        // Endereço do contrato do .env
        const contractAddress = process.env.BSC_CONTRACT_ADDRESS;

        // Carregar wallet para transferência (precisa ter tokens)
        let contract;

        const walletKeystorePath = './wallets/minter-0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3.keystore.json';
        const keystoreJson = fs.readFileSync(walletKeystorePath, 'utf8');
        const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, process.env.WALLET_PASSWORD);
        const connectedWallet = wallet.connect(provider);
        console.log(connectedWallet.address, "🔑 Wallet carregada");

        // Criar instância do contrato conectada com a wallet        
        contract = new ethers.Contract(contractAddress, BBRL_PLUS_ABI, connectedWallet);
        console.log("🔐 Contrato conectado com a wallet");


        // Parâmetros de exemplo para estimativa
        const sampleParams = {
            to: "0x1cc0fa6105f1d74E0D8fa57b3D83201F4712a071", // Endereço de exemplo
            amount: ethers.parseUnits("1000", 18), // 1000 tokens (assumindo 18 decimais)
            ref: "GAS_ESTIMATION_TEST" // Referência de teste
        };      

        console.log("🔗 Conectando à BSC...");
        console.log(`📋 Contrato: ${contractAddress}`);
        console.log(`🌐 RPC: ${process.env.BSC_NODE_URL}`);
        console.log("");

        console.log("⚙️  Parâmetros para estimativa:");
        console.log(`   to: ${sampleParams.to}`);
        console.log(`   amount: ${ethers.formatUnits(sampleParams.amount, 18)} tokens`);
        console.log(`   ref: "${sampleParams.ref}"`);
        console.log("");

        // Verificar se o contrato existe e tem as funções básicas
        console.log("🔍 Verificando contrato...");
        try {
            const [name, symbol, decimals] = await Promise.all([
                contract.name(),
                contract.symbol(), 
                contract.decimals()
            ]);
            console.log(`✅ Contrato válido: ${name} (${symbol}) - ${decimals} decimais`);
        } catch (contractError) {
            console.error('❌ Erro ao verificar contrato:', contractError.message);
            console.error('💡 O contrato pode não estar implantado no endereço especificado');
            throw contractError;
        }

        // Verificar se a carteira tem saldo suficiente
        console.log("� Verificando saldo da carteira...");
        try {
            const balance = await contract.balanceOf(connectedWallet.address);
            const balanceFormatted = ethers.formatUnits(balance, 18);
            const requiredAmount = ethers.formatUnits(sampleParams.amount, 18);
            
            console.log(`   Saldo atual: ${balanceFormatted} tokens`);
            console.log(`   Quantidade para transferir: ${requiredAmount} tokens`);
            
            if (balance < sampleParams.amount) {
                console.error('❌ A carteira não possui saldo suficiente');
                console.error(`   Carteira: ${connectedWallet.address}`);
                console.error(`   Saldo atual: ${balanceFormatted} tokens`);
                console.error(`   Necessário: ${requiredAmount} tokens`);
                throw new Error('Wallet não possui saldo suficiente para a transferência');
            }
            
            console.log('✅ Carteira possui saldo suficiente');
        } catch (balanceError) {
            if (balanceError.message.includes('saldo suficiente')) {
                throw balanceError;
            }
            console.error('❌ Erro ao verificar saldo da carteira:', balanceError.message);
            throw balanceError;
        }

        // Verificar se o contrato está pausado
        console.log("⏸️  Verificando se o contrato está pausado...");
        try {
            const isPaused = await contract.paused();
            if (isPaused) {
                console.error('❌ O contrato está pausado');
                throw new Error('Contrato está pausado, não é possível transferir tokens');
            }
            console.log('✅ Contrato não está pausado');
        } catch (pauseError) {
            if (pauseError.message.includes('pausado')) {
                throw pauseError;
            }
            console.log('⚠️  Não foi possível verificar se o contrato está pausado (função pode não existir)');
        }

        // Estimar gas para o método transferWithRef
        console.log("⏳ Estimando gas...");

        // Primeiro, validar se a transação pode ser executada (pre-flight check)
        let gasEstimate;
        try {
            gasEstimate = await contract.transferWithRef.estimateGas(sampleParams.to, sampleParams.amount, sampleParams.ref);
        } catch (error) {
            console.error('❌ Erro ao estimar gas:', error.message);
            
            // Adicionar mais detalhes sobre o erro
            if (error.code === 'BUFFER_OVERRUN') {
                console.error('💡 Este erro pode indicar que:');
                console.error('   - A função transferWithRef não existe no contrato');
                console.error('   - O contrato está pausado');
                console.error('   - Há problemas com os parâmetros fornecidos');
                console.error('   - O endereço de destino é inválido');
                console.error('   - A carteira não possui saldo suficiente');
            }
            
            throw error;
        }

        console.log("✅ Estimativa concluída!");
        console.log("");
        console.log("📊 Resultados:");
        console.log(`   Estimated Gas: ${gasEstimate.toString()}`);
        console.log(`   Gas Limit Recomendado: ${(gasEstimate * 120n / 100n).toString()} (com 20% buffer)`);
        console.log(`   Gas Limit Conservador: ${(gasEstimate * 150n / 100n).toString()} (com 50% buffer)`);

        // Adicionar informações sobre custos estimados em BNB
        try {
            let gasPrice;
            let gasPriceSource = "network";

            try {
                gasPrice = await provider.getGasPrice();
                console.log(`\n📡 Gas price obtido da rede: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
            } catch (gasPriceError) {
                // Fallback: usar gas price típico da BSC (5 Gwei)
                gasPrice = ethers.parseUnits("5", "gwei");
                gasPriceSource = "fallback";
                console.log(`\n💡 Usando gas price padrão da BSC: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
            }

            const costInWei = gasEstimate * gasPrice;
            const costInBNB = ethers.formatEther(costInWei);
            const costWithBufferInWei = (gasEstimate * 120n / 100n) * gasPrice;
            const costWithBufferInBNB = ethers.formatEther(costWithBufferInWei);
            const costConservativeInWei = (gasEstimate * 150n / 100n) * gasPrice;
            const costConservativeInBNB = ethers.formatEther(costConservativeInWei);

            console.log("");
            console.log("💰 Custo Estimado:");
            console.log(`   Gas Price (${gasPriceSource}): ${ethers.formatUnits(gasPrice, 'gwei')} Gwei`);
            console.log(`   Custo Base: ~${parseFloat(costInBNB).toFixed(6)} BNB`);
            console.log(`   Custo c/ Buffer 20%: ~${parseFloat(costWithBufferInBNB).toFixed(6)} BNB`);
            console.log(`   Custo Conservador 50%: ~${parseFloat(costConservativeInBNB).toFixed(6)} BNB`);

           
        } catch (error) {
            console.log(`\n⚠️  Erro ao calcular custos estimados: ${error.message}`);
        }

        // Preparar resultado estruturado para retorno
        const gasEstimationResult = {
            success: true,
            estimatedGas: gasEstimate.toString(),
            recommendedGasLimit: (gasEstimate * 120n / 100n).toString(),
            conservativeGasLimit: (gasEstimate * 150n / 100n).toString(),
            canExecute: true, // Se chegou até aqui, a transação pode ser executada
            timestamp: new Date().toISOString(),
            method: 'transferWithRef',
            parameters: {
                to: sampleParams.to,
                amount: ethers.formatUnits(sampleParams.amount, 18),
                ref: sampleParams.ref
            }
        };

        return gasEstimationResult;

    } catch (error) {
        console.error("❌ Erro ao estimar gas:", error.message);

        // Tratamento específico de erros baseado nos tipos do Ethers.js v5
        if (error.code === 'NETWORK_ERROR' || error.message.includes("could not detect network")) {
            console.error("🌐 Erro de rede detectado");
            console.error("💡 Verifique se BSC_NODE_URL está correto no arquivo .env");
            console.error("💡 Verifique sua conexão com a internet");
        } else if (error.code === 'INVALID_ARGUMENT' || error.message.includes("invalid address")) {
            console.error("📝 Argumento inválido detectado");
            console.error("💡 Verifique se BSC_CONTRACT_ADDRESS está correto no arquivo .env");
            console.error("💡 Verifique se os endereços têm o formato correto (checksum)");
        } else if (error.code === 'CALL_EXCEPTION') {
            console.error("🔧 Erro na chamada do contrato");
            console.error(`💡 Razão: ${error.reason || 'Não especificada'}`);
            console.error("💡 O contrato pode não estar implantado no endereço especificado");
            console.error("💡 Ou a função transferWithRef pode não existir com os parâmetros fornecidos");
        } else if (error.code === 'INSUFFICIENT_FUNDS') {
            console.error("💰 Fundos insuficientes");
            console.error("💡 A wallet não tem BNB suficiente para executar a transação");
        } else if (error.code === 'UNPREDICTABLE_GAS_LIMIT') {
            console.error("⚡ Não foi possível prever o limite de gas");
            console.error("💡 A transação pode falhar por razões de lógica de negócio");
            console.error("💡 Verifique se a wallet tem saldo suficiente para a transferência");
        } else {
            console.error("❓ Erro não categorizado");
            console.error(`💡 Código do erro: ${error.code || 'N/A'}`);
            console.error(`💡 Dados adicionais: ${error.data || 'N/A'}`);
        }

        console.error("\n🔍 Para mais detalhes, execute com variável de ambiente DEBUG=ethers*");
        console.error("   Exemplo: DEBUG=ethers* node gasLimitCalculator.js");

        process.exit(1);
    }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    estimateGasForMintRef()
        .then(() => {
            console.log("\n🎉 Script executado com sucesso!");
            process.exit(0);
        })
        .catch(error => {
            console.error("💥 Erro fatal:", error);
            process.exit(1);
        });
}

export { estimateGasForMintRef, estimateGasForTransferWithRef };