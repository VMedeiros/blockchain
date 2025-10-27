# AuthBank Scripts

Scripts utilitários (Node.js + ethers v6) para geração, criptografia e validação segura de carteiras Ethereum, incluindo estimadores de gas, mint de tokens e gerenciamento de grupos de pagamento para os contratos BBRLPlus, PaymentGroup e PaymentGroupFactory.

## � Índice

- [�🚀 Início Rápido](#-início-rápido)
- [🎯 Objetivo](#-objetivo)
- [📋 Pré-requisitos](#-pré-requisitos)
- [⚙️ Instalação](#️-instalação)
- [🔧 Configuração](#-configuração)
- [📁 Estrutura do Projeto](#-estrutura-do-projeto)
- [🔑 Scripts de Carteira](#-scripts-de-carteira)
- [🪙 Scripts BBRLPlus](#-scripts-bbrlplus)
- [👥 Scripts PaymentGroup](#-scripts-paymentgroup)
- [🏭 Scripts PaymentGroupFactory](#-scripts-paymentgroupfactory)
- [💻 Comandos Úteis](#-comandos-úteis)
- [🔒 Segurança e Boas Práticas](#-segurança-e-boas-práticas)
- [📝 Exemplos de Uso](#-exemplos-de-uso)
- [🔮 Próximos Passos](#-próximos-passos)
- [⚖️ Aviso Legal](#️-aviso-legal)

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env  # Edite com suas configurações

# Gerar nova carteira
npm run generate:wallet -- --label minha-carteira

# Verificar roles no BBRLPlus
npm run role:check -- --address 0x...

# Mintar tokens BBRLPlus
npm run mint:tokens -- --to 0x... --amount 100

# Criar novo PaymentGroup
npm run create:group -- --origin-token 0x... --payment-token 0x... --admin 0x...

# Adicionar participante a um PaymentGroup
npm run add:participant -- --account 0x...

# Disparar distribuição de pagamentos
npm run trigger:payment
```

## 🎯 Objetivo

Facilitar a criação e manejo de carteiras Ethereum em ambiente de desenvolvimento ou scripts operacionais, mantendo foco em segurança: criptografia forte (scrypt), políticas de senha e permissões de arquivo restritas. Além disso, fornece ferramentas para interação com contratos inteligentes BBRLPlus, PaymentGroup e PaymentGroupFactory.

## 📋 Pré-requisitos

- Node.js >= 18.18.0 (recomendado LTS atual)
- npm ou pnpm
- Ambiente seguro (evitar hosts comprometidos / terminais gravados)

## ⚙️ Instalação

```bash
cd authbank-scripts
npm install
cp .env.example .env  # Ajuste a senha ou use variável de ambiente externa
```

## 🔧 Configuração

### Arquivo `.env`

```bash
# Redes
BSC_NODE_URL=https://bsc-dataseed.binance.org/
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/

# Contratos BBRLPlus
BSC_CONTRACT_ADDRESS=0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc
BSC_TESTNET_CONTRACT_ADDRESS=0x...

# Contratos PaymentGroup
BSC_PAYMENT_GROUP_ADDRESS=0x...
BSC_TESTNET_PAYMENT_GROUP_ADDRESS=0x...

# Contratos PaymentGroupFactory
BSC_PAYMENT_GROUP_FACTORY_ADDRESS=0x...
BSC_TESTNET_PAYMENT_GROUP_FACTORY_ADDRESS=0x...

# Segurança
WALLET_PASSWORD=sua_senha_ultra_forte_aqui
```

### Endereços de Carteiras

As carteiras keystore estão localizadas em `wallets/`:
- `admin-0xb5d6B26818A777Aff58C46C297458fFa6fdd2426.keystore.json` - Admin geral
- `minter-0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3.keystore.json` - Para mint de tokens
- `burner-0x26Df3718044BEF34e7bdB9FbEf26771F5d1fa51a.keystore.json` - Para burn de tokens
- `pauser-0xeB6197375Bc88A8E6673b909F4E3B6Ee3ead8255.keystore.json` - Para pausar/unpausar
- `recovery-0x8ca109d240976eAAE8D0AFc0cf61B9a1BEBD0711.keystore.json` - Para recuperação

## 📁 Estrutura do Projeto

```
authbank-scripts/
├── abi/
│   ├── BBRLPlus.json
│   ├── PaymentGroup.json
│   └── PaymentGroupFactory.json
├── scripts/
│   ├── decryptWallet.js
│   ├── gasLimitCalculator.js
│   ├── generateWallet.js
│   ├── mintTokens.js
│   ├── roleChecker.js
│   ├── PaymentGroup/
│   │   ├── addParticipant.js
│   │   ├── removeParticipant.js
│   │   └── triggerPayment.js
│   └── PaymentGroupFactory/
│       ├── createPaymentGroup.js
│       └── listGroups.js
├── wallets/
│   └── *.keystore.json
├── package.json
├── README.md
└── .env
```

## 🔑 Scripts de Carteira

### Geração de Carteira (`generateWallet`)

Cria uma nova carteira + mnemonic BIP39 a partir de entropia (16/24/32 bytes) e gera um keystore JSON (Web3 Secret Storage). O arquivo é salvo com permissões 600.

**Opções principais:**
- `--out-dir, -o` Diretório onde salvar (default: wallets)
- `--label, -l` Rótulo para compor nome do arquivo (default: timestamp ISO)
- `--strength` Entropia em bytes (16=128b, 24=192b, 32=256b)
- `--show-mnemonic` Exibe a seed (NÃO recomendado)
- `--password, -p` Fornece a senha inline (desaconselhado – preferir prompt ou env)

**Fluxo de senha:** flag -> `WALLET_PASSWORD` -> prompt oculto (com confirmação).

**Validação de senha:** exige 12+ chars, maiúscula, minúscula, dígito, caractere especial.

**Criptografia:** `scrypt` com parâmetros N=2^18, r=8, p=1.

**Exemplo:**
```bash
WALLET_PASSWORD='SenhaUltraForte!123' npm run generate:wallet -- --label minha
```

### Descriptografia / Validação (`decryptWallet`)

Lê o keystore JSON e tenta decriptar com a senha informada. Permite (opcional) exibir mnemonic ou chave privada.

**Opções:**
- `--file, -f` Caminho do keystore (obrigatório)
- `--password, -p` Senha (ou usar prompt/env)
- `--show-mnemonic` Mostra mnemonic (sensível)
- `--show-private-key` Mostra chave privada (altamente sensível)

**Exemplo:**
```bash
WALLET_PASSWORD='SenhaUltraForte!123' npm run decrypt:wallet -- --file wallets/minha-0x....keystore.json
```

## 🪙 Scripts BBRLPlus

### Estimativa de Gas (`gasLimitCalculator`)

Estima o gas limit necessário para os métodos `mintRef` e `transferWithRef` do contrato BBRLPlus na rede BSC.

#### Estimativa para Mint (`estimateGasForMintRef`)
- Usa wallet com permissão `MINTER_ROLE`
- Verifica permissões e status do contrato
- Calcula custos em BNB baseado no gas price da rede

#### Estimativa para Transfer (`estimateGasForTransferWithRef`)
- Usa wallet com saldo suficiente
- Verifica se o contrato não está pausado
- Calcula custos em BNB baseado no gas price da rede

**Exemplo de uso:**
```bash
npm run gas:limit
```

**Resultado típico:**
```
📊 Resultados:
   Estimated Gas: 95000
   Gas Limit Recomendado: 114000 (com 20% buffer)
   Gas Limit Conservador: 142500 (com 50% buffer)

💰 Custo Estimado:
   Gas Price: 5.0 Gwei
   Custo Base: ~0.000475 BNB
   Custo c/ Buffer 20%: ~0.000570 BNB
   Custo Conservador 50%: ~0.000712 BNB
```

### Mint de Tokens (`mintTokens`)

Script para mintar tokens BBRLPlus usando a carteira minter configurada.

**Características principais:**
- **Carteira Minter:** `minter-0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3.keystore.json`
- **Redes:** BSC mainnet e testnet
- **Validação:** Verifica MINTER_ROLE antes de executar
- **Gas:** Estimativa automática com buffer de 20%
- **Modo Dry-run:** Simulação sem execução
- **Parsing:** Detecta automaticamente tokens vs wei

**Opções:**
- `--to, -t` Endereço de destino (obrigatório)
- `--amount, -a` Quantidade a mintar (obrigatório)
- `--network, -n` Rede blockchain (default: bsc)
- `--ref, -r` Referência (default: timestamp)
- `--contract, -c` Endereço do contrato (sobrescreve .env)
- `--gas-limit, -g` Limite de gas personalizado
- `--dry-run` Simula sem executar

**Exemplos:**
```bash
# Mint básico
npm run mint:tokens -- --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 100

# Com referência
npm run mint:tokens -- --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 500 --ref "campaign-Q1-2025"

# Testnet
npm run mint:tokens -- --network bscTestnet --to 0x... --amount 1000

# Simulação
npm run mint:tokens -- --to 0x... --amount 100 --dry-run
```

### Verificação de Roles (`roleChecker`)

Verifica as roles de uma carteira no contrato BBRLPlus.

**Exemplo:**
```bash
npm run role:check -- --address 0x...
```

## 👥 Scripts PaymentGroup

Scripts para gerenciar contratos PaymentGroup, que permitem distribuição automática de recompensas baseada no saldo de tokens de origem dos participantes.

### Adicionar Participante (`addParticipant`)

Adiciona um endereço como participante de um PaymentGroup.

**Características:**
- Usa wallet com OPERATOR_ROLE
- Verifica se o contrato não está pausado
- Valida endereço fornecido

**Exemplo:**
```bash
npm run add:participant -- --account 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

### Remover Participante (`removeParticipant`)

Remove um endereço da lista de participantes.

**Exemplo:**
```bash
npm run remove:participant -- --account 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

### Disparar Pagamentos (`triggerPayment`)

Executa distribuição de recompensas para todos os participantes baseada em seus saldos de token de origem.

**Características:**
- Calcula recompensas automaticamente
- Minta tokens de pagamento para cada participante
- Emite eventos detalhados
- Suporte a preview sem execução

**Exemplos:**
```bash
# Executar distribuição
npm run trigger:payment

# Apenas visualizar
npm run trigger:payment -- --preview-only
```

## 🏭 Scripts PaymentGroupFactory

Scripts para criar e gerenciar instâncias de PaymentGroup através da factory.

### Criar PaymentGroup (`createPaymentGroup`)

Cria uma nova instância de PaymentGroup com parâmetros específicos.

**Parâmetros obrigatórios:**
- `--origin-token, -o` Endereço do token de origem (ex: BBRL)
- `--payment-token, -p` Endereço do token de pagamento (ex: BBRL)
- `--admin, -a` Endereço do admin do novo grupo

**Parâmetros opcionais:**
- `--reward-percent, -r` Percentual de recompensa em basis points (default: 50000 = 5%)

**Exemplo:**
```bash
npm run create:group -- --origin-token 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc --payment-token 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc --admin 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426
```

### Listar Grupos Criados (`listGroups`)

Lista todos os PaymentGroups criados pela factory com paginação.

**Parâmetros opcionais:**
- `--offset` Offset para paginação (default: 0)
- `--limit` Limite de resultados (default: 10)

**Exemplos:**
```bash
# Listar primeiros 10
npm run list:groups

# Listar próximos 5
npm run list:groups -- --offset 10 --limit 5
```

## 💻 Comandos Úteis

### Scripts BBRLPlus
```bash
# Estimar gas
npm run gas:mint
npm run gas:transfer
npm run gas:limit

# Operações
npm run role:check -- --address 0x...
npm run mint:tokens -- --to 0x... --amount 100
```

### Scripts PaymentGroup
```bash
npm run add:participant -- --account 0x...
npm run remove:participant -- --account 0x...
npm run trigger:payment
npm run trigger:payment -- --preview-only
```

### Scripts PaymentGroupFactory
```bash
npm run create:group -- --origin-token 0x... --payment-token 0x... --admin 0x...
npm run list:groups
npm run list:groups -- --offset 10 --limit 5
```

### Utilitários Gerais
```bash
# Carteiras
npm run generate:wallet -- --label minha-carteira
npm run decrypt:wallet -- --file wallets/minha-carteira-0x....keystore.json

# Sistema
ls -l wallets/
chmod 400 wallets/*.keystore.json
history -d $(history | tail -n 1 | awk '{print $1}')
```

### Desenvolvimento
```bash
# Verificar sintaxe
node --check scripts/generateWallet.js

# Testar ABI
node -e "console.log(JSON.parse(require('fs').readFileSync('./abi/BBRLPlus.json')).filter(f => f.type === 'function').map(f => f.name))"
```

## 🔒 Segurança e Boas Práticas

- **NÃO reutilize** senha de outros serviços
- Evite passar `--password` na linha de comando (pode ficar em histórico)
- Use password manager ou variáveis temporárias de shell
- Faça backup offline e redundante (hardware encrypted USB + cofre físico)
- Nunca exponha mnemonic, private key ou JSON criptografado em issues/commits/logs
- Restrinja permissões: arquivos keystore devem ser 600 (ou 400 se somente leitura)
- Evite rodar em servidores multiusuário sem isolamento apropriado
- Revogue/descarte carteiras comprometidas imediatamente e transfira fundos

## 📝 Exemplos de Uso

### Gerar Carteira
```bash
# Com prompt de senha
npm run generate:wallet -- --label teste

# Com entropia 256 bits (não recomendado mostrar mnemonic)
WALLET_PASSWORD='SenhaUltraForte!123' npm run generate:wallet -- --strength 32 --show-mnemonic
```

### Validar Carteira
```bash
# Descriptografar e validar
WALLET_PASSWORD='SenhaUltraForte!123' npm run decrypt:wallet -- --file wallets/teste-0xABC...keystore.json

# Mostrar mnemonic (sensível)
WALLET_PASSWORD='SenhaUltraForte!123' npm run decrypt:wallet -- --file wallets/teste-0xABC...keystore.json --show-mnemonic
```

### Operações BBRLPlus
```bash
# Verificar roles
npm run role:check -- --address 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426

# Mint com referência
npm run mint:tokens -- --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 100 --ref "teste-mint"
```

### Operações PaymentGroup
```bash
# Gerenciar participantes
npm run add:participant -- --account 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
npm run remove:participant -- --account 0x742d35Cc6634C0532925a3b844Bc454e4438f44e

# Distribuir recompensas
npm run trigger:payment -- --preview-only  # Visualizar primeiro
npm run trigger:payment  # Executar
```

### Operações PaymentGroupFactory
```bash
# Criar grupo
npm run create:group \
  --origin-token 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc \
  --payment-token 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc \
  --admin 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 \
  --reward-percent 75000

# Listar grupos
npm run list:groups -- --limit 20
```

## 🔮 Próximos Passos

- Integrar ESLint + Prettier
- Adicionar suporte a derivação HD: múltiplos paths (m/44'/60'/0'/0/n)
- Suporte a exportação para hardware wallet
- Testes automatizados (ex: vitest) para funções de utilidade
- Opção para Argon2id em vez de scrypt (pacotes nativos exigem build)
- Adicionar scripts para mais métodos dos contratos (pause/unpause, setRewardPercent, etc.)

## ⚖️ Aviso Legal

Uso por sua conta e risco. Verifique requisitos regulatórios e de compliance antes de manipular chaves em produção.

---
Para dúvidas ou melhorias, abrir uma issue no repositório principal.## 7. Estimativa de Gas (`gasLimitCalculator`)
Estima o gas limit necessário para os métodos `mintRef` e `transferWithRef` do contrato BBRLPlus na rede BSC.

### 7.1. Estimativa para Mint (`estimateGasForMintRef`)
Estima o gas necessário para mintar tokens usando a função `mintRef`.

**Características:**
- Usa wallet com permissão `MINTER_ROLE`
- Verifica se a wallet tem permissões adequadas
- Valida se o contrato não está pausado
- Calcula custos em BNB baseado no gas price da rede

**Configurações necessárias no `.env`:**
- `BSC_NODE_URL`: URL do nó BSC
- `BSC_CONTRACT_ADDRESS`: Endereço do contrato BBRLPlus
- `WALLET_PASSWORD`: Senha da wallet minter

**Exemplo de uso:**
```bash
npm run gas:limit
```

### 7.2. Estimativa para Transfer (`estimateGasForTransferWithRef`)
Estima o gas necessário para transferir tokens usando a função `transferWithRef`.

**Características:**
- Usa wallet que deve ter tokens para transferir
- Verifica se a wallet tem saldo suficiente
- Valida se o contrato não está pausado
- Calcula custos em BNB baseado no gas price da rede

**Para executar apenas a estimativa de transfer:**
```javascript
import { estimateGasForTransferWithRef } from './scripts/gasLimitCalculator.js';

async function testTransfer() {
    const result = await estimateGasForTransferWithRef();
    console.log(result);
}
```

**Ou usando o script de teste criado:**
```bash
node test-transfer-gas.js
```

### 7.3. Resultado Típico para Ambas as Funções:
```
🔗 Conectando à BSC...
📋 Contrato: 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc
🌐 RPC: https://bsc-dataseed1.binance.org/

⚙️  Parâmetros para estimativa:
   to: 0x1cc0fa6105f1d74E0D8fa57b3D83201F4712a071
   amount: 1000.0 tokens
   ref: "GAS_ESTIMATION_TEST"

✅ Contrato válido: DEMO BR (DEMOBR) - 18 decimais
✅ Carteira possui saldo suficiente (para transfer) / role de MINTER (para mint)
✅ Contrato não está pausado

📊 Resultados:
   Estimated Gas: 95000
   Gas Limit Recomendado: 114000 (com 20% buffer)
   Gas Limit Conservador: 142500 (com 50% buffer)

💰 Custo Estimado:
   Gas Price: 5.0 Gwei
   Custo Base: ~0.000475 BNB
   Custo c/ Buffer 20%: ~0.000570 BNB
   Custo Conservador 50%: ~0.000712 BNB
```

### 7.4. Diferenças Entre os Estimadores:

| Característica | `estimateGasForMintRef` | `estimateGasForTransferWithRef` |
|---|---|---|
| **Função do Contrato** | `mintRef(to, amount, ref)` | `transferWithRef(to, amount, ref)` |
| **Pré-requisito** | Wallet com `MINTER_ROLE` | Wallet com saldo suficiente |
| **Verificação Principal** | `hasRole(MINTER_ROLE, address)` | `balanceOf(address) >= amount` |
| **Operação** | Criação de novos tokens | Transferência de tokens existentes |
| **Script NPM** | `npm run gas:mint` | `npm run gas:transfer` |
| **Custo Típico** | ~95.000 gas | ~85.000 gas |

### 7.5. Estrutura do Resultado Retornado:
```javascript
{
    success: true,
    estimatedGas: "95000",
    recommendedGasLimit: "114000", // +20% buffer
    conservativeGasLimit: "142500", // +50% buffer
    canExecute: true,
    timestamp: "2025-09-29T10:30:00.000Z",
    method: "mintRef" | "transferWithRef",
    parameters: {
        to: "0x1cc0fa6105f1d74E0D8fa57b3D83201F4712a071",
        amount: "1000.0",
        ref: "GAS_ESTIMATION_TEST"
    }
}
```

### 7.6. Tratamento de Erros Comuns:

**Para Mint:**
- `MINTER_ROLE não encontrado`: Wallet não tem permissão para mintar
- `Contrato pausado`: Operações de mint estão temporariamente desabilitadas

**Para Transfer:**
- `Saldo insuficiente`: Wallet não tem tokens suficientes para transferir
- `Endereço negado`: Destinatário está na deny list do contrato

**Erros Gerais:**
- `NETWORK_ERROR`: Problema de conexão com a BSC
- `INVALID_ARGUMENT`: Endereço de contrato ou parâmetros inválidos
- `UNPREDICTABLE_GAS_LIMIT`: Transação pode falhar por regras de negócio

## 8. Mint de Tokens (`mintTokens`)
Script para mintar tokens BBRLPlus usando a carteira minter configurada. Conecta na rede BSC (ou testnet), valida permissões de MINTER_ROLE e executa a função `mintRef` do contrato.

### Características principais:
- **Carteira Minter**: Usa automaticamente a carteira `minter-0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3.keystore.json`
- **Redes Suportadas**: BSC mainnet e testnet
- **Validação de Role**: Verifica se a carteira possui MINTER_ROLE antes de executar
- **Estimativa de Gas**: Calcula automaticamente o gas necessário com buffer de 20%
- **Modo Dry-run**: Permite simular a transação sem executar
- **Parsing Inteligente**: Detecta automaticamente se o valor é em tokens ou wei

### Configurações necessárias no `.env`:
- `BSC_NODE_URL`: URL do nó BSC
- `BSC_CONTRACT_ADDRESS`: Endereço do contrato BBRLPlus
- `WALLET_PASSWORD`: Senha da carteira minter

### Opções do comando:
- `--to, -t` Endereço de destino (obrigatório)
- `--amount, -a` Quantidade a mintar - aceita "100.5" ou "100500000000000000000" (obrigatório)
- `--network, -n` Rede blockchain (bsc ou bscTestnet, default: bsc)
- `--ref, -r` Referência para o mint (default: timestamp automático)
- `--contract, -c` Endereço do contrato (sobrescreve .env)
- `--gas-limit, -g` Limite de gas personalizado
- `--dry-run` Simula transação sem executar

### Exemplos de uso:

**Mint básico (100 tokens):**
```bash
npm run mint:tokens -- --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 100
```

**Mint com referência personalizada:**
```bash
npm run mint:tokens -- --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 500 --ref "campaign-Q1-2025"
```

**Teste na BSC testnet:**
```bash
npm run mint:tokens -- --network bscTestnet --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 1000
```

**Simulação (dry-run):**
```bash
npm run mint:tokens -- --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 100 --dry-run
```

**Mint com valores decimais:**
```bash
npm run mint:tokens -- --to 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426 --amount 100.5
```

### Saída típica:
```
🪙 AuthBank Token Minter
========================

✅ ABI carregado com sucesso
✅ Carteira minter carregada: 0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3
✅ Conectado à rede: Binance Smart Chain (Chain ID: 56)
✅ Contrato conectado: 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc
   Token: DEMO BR (DEMOBR)
   Decimais: 18
✅ Carteira possui role de MINTER

💰 Quantidade parseada: 100.0 DEMOBR

📝 Preparando transação de mint...
   Para: 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426
   Quantidade: 100.0 tokens
   Saldo da carteira: 0.05 BNB

⏳ Estimando gas...
   Gas estimado: 114000

🚀 Executando transação de mint...
✅ Transação enviada: 0x1234...abcd
⏳ Aguardando confirmação...
✅ Transação confirmada!
   Block: 43829405
   Gas usado: 95247
   Taxa de gas: 0.000476235 BNB

🎉 Mint realizado com sucesso!
```

## 9. PaymentGroup - Gerenciamento de Grupos de Pagamento

Scripts para gerenciar contratos PaymentGroup, que permitem distribuição automática de recompensas baseada no saldo de tokens de origem dos participantes.

### 9.1. Adicionar Participante (`addParticipant`)

Adiciona um endereço como participante de um PaymentGroup.

**Características:**
- Usa wallet com OPERATOR_ROLE
- Verifica se o contrato não está pausado
- Valida endereço fornecido

**Configurações necessárias no `.env`:**
- `BSC_PAYMENT_GROUP_ADDRESS`: Endereço do contrato PaymentGroup
- `WALLET_PASSWORD`: Senha da wallet admin/operator

**Exemplo de uso:**
```bash
npm run add:participant -- --account 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

### 9.2. Remover Participante (`removeParticipant`)

Remove um endereço da lista de participantes.

**Exemplo de uso:**
```bash
npm run remove:participant -- --account 0x742d35Cc6634C0532925a3b844Bc454e4438f44e
```

### 9.3. Disparar Pagamentos (`triggerPayment`)

Executa distribuição de recompensas para todos os participantes baseada em seus saldos de token de origem.

**Características:**
- Calcula recompensas automaticamente
- Minta tokens de pagamento para cada participante
- Emite eventos detalhados

**Exemplo de uso:**
```bash
npm run trigger:payment
```

**Ou apenas visualizar sem executar:**
```bash
npm run trigger:payment -- --preview-only
```

## 10. PaymentGroupFactory - Fábrica de Grupos

Scripts para criar e gerenciar instâncias de PaymentGroup através da factory.

### 10.1. Criar PaymentGroup (`createPaymentGroup`)

Cria uma nova instância de PaymentGroup com parâmetros específicos.

**Parâmetros obrigatórios:**
- `--origin-token, -o`: Endereço do token de origem (ex: BBRL)
- `--payment-token, -p`: Endereço do token de pagamento (ex: BBRL)
- `--admin, -a`: Endereço do admin do novo grupo

**Parâmetros opcionais:**
- `--reward-percent, -r`: Percentual de recompensa em basis points (default: 50000 = 5%)

**Configurações necessárias no `.env`:**
- `BSC_PAYMENT_GROUP_FACTORY_ADDRESS`: Endereço do contrato PaymentGroupFactory

**Exemplo de uso:**
```bash
npm run create:group -- --origin-token 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc --payment-token 0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc --admin 0xb5d6B26818A777Aff58C46C297458fFa6fdd2426
```

### 10.2. Listar Grupos Criados (`listGroups`)

Lista todos os PaymentGroups criados pela factory.

**Parâmetros opcionais:**
- `--offset`: Offset para paginação (default: 0)
- `--limit`: Limite de resultados (default: 10)

**Exemplo de uso:**
```bash
npm run list:groups
```

**Listar próximos 5 grupos:**
```bash
npm run list:groups -- --offset 10 --limit 5
```

## 11. Configuração de Ambiente

### 11.1. Arquivo `.env`

```bash
# Redes
BSC_NODE_URL=https://bsc-dataseed.binance.org/
BSC_TESTNET_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/

# Contratos BBRLPlus
BSC_CONTRACT_ADDRESS=0x568365eC1dF7e124DE379F9D4051A9f9C35CaeCc
BSC_TESTNET_CONTRACT_ADDRESS=0x...

# Contratos PaymentGroup
BSC_PAYMENT_GROUP_ADDRESS=0x...
BSC_TESTNET_PAYMENT_GROUP_ADDRESS=0x...

# Contratos PaymentGroupFactory
BSC_PAYMENT_GROUP_FACTORY_ADDRESS=0x...
BSC_TESTNET_PAYMENT_GROUP_FACTORY_ADDRESS=0x...

# Segurança
WALLET_PASSWORD=sua_senha_ultra_forte_aqui
```

### 11.2. Endereços de Carteiras

As carteiras keystore estão localizadas em `wallets/`:
- `admin-0xb5d6B26818A777Aff58C46C297458fFa6fdd2426.keystore.json` - Admin geral
- `minter-0xE4055E9875087ee2a6d93Fd6268d12e4Bd6551B3.keystore.json` - Para mint de tokens
- `burner-0x26Df3718044BEF34e7bdB9FbEf26771F5d1fa51a.keystore.json` - Para burn de tokens
- `pauser-0xeB6197375Bc88A8E6673b909F4E3B6Ee3ead8255.keystore.json` - Para pausar/unpausar
- `recovery-0x8ca109d240976eAAE8D0AFc0cf61B9a1BEBD0711.keystore.json` - Para recuperação

## 12. Comandos Úteis

### Scripts BBRLPlus
```bash
# Estimar gas para mint
npm run gas:mint

# Estimar gas para transfer
npm run gas:transfer

# Verificar roles
npm run role:check -- --address 0x...

# Mintar tokens
npm run mint:tokens -- --to 0x... --amount 100
```

### Scripts PaymentGroup
```bash
# Adicionar participante
npm run add:participant -- --account 0x...

# Remover participante
npm run remove:participant -- --account 0x...

# Disparar pagamentos
npm run trigger:payment

# Visualizar recompensas
npm run trigger:payment -- --preview-only
```

### Scripts PaymentGroupFactory
```bash
# Criar novo grupo
npm run create:group -- --origin-token 0x... --payment-token 0x... --admin 0x...

# Listar grupos criados
npm run list:groups
```

### Utilitários Gerais
```bash
# Gerar nova carteira
npm run generate:wallet -- --label minha-carteira

# Descriptografar carteira
npm run decrypt:wallet -- --file wallets/minha-carteira-0x....keystore.json
```

## 13. Estrutura dos Scripts

```
authbank-scripts/
├── abi/
│   ├── BBRLPlus.json
│   ├── PaymentGroup.json
│   └── PaymentGroupFactory.json
├── scripts/
│   ├── decryptWallet.js
│   ├── gasLimitCalculator.js
│   ├── generateWallet.js
│   ├── mintTokens.js
│   ├── roleChecker.js
│   ├── PaymentGroup/
│   │   ├── addParticipant.js
│   │   ├── removeParticipant.js
│   │   └── triggerPayment.js
│   └── PaymentGroupFactory/
│       ├── createPaymentGroup.js
│       └── listGroups.js
├── wallets/
│   └── *.keystore.json
├── package.json
├── README.md
└── .env
```

## 14. Próximos Passos Opcionais
- Integrar ESLint + Prettier.
- Adicionar suporte a derivação HD: múltiplos paths (m/44'/60'/0'/n).
- Suporte a exportação para hardware wallet.
- Testes automatizados (ex: vitest) para funções de utilidade.
- Opção para Argon2id em vez de scrypt (pacotes nativos exigem build).
- Adicionar scripts para mais métodos dos contratos (pause/unpause, setRewardPercent, etc.).

## Aviso Legal
Uso por sua conta e risco. Verifique requisitos regulatórios e de compliance antes de manipular chaves em produção.

---
Para dúvidas ou melhorias, abrir uma issue no repositório principal.o
1. Objetivo
2. Pré-requisitos
3. Instalação
4. Estrutura
5. Geração de Carteira (`generateWallet`)
6. Descriptografia / Validação (`decryptWallet`)
7. Segurança e Boas Práticas
8. Exemplos de Uso
9. Comandos Úteis
10. Próximos Passos Opcionais

## 1. Objetivo
Facilitar a criação e manejo de carteiras Ethereum em ambiente de desenvolvimento ou scripts operacionais, mantendo foco em segurança: criptografia forte (scrypt), políticas de senha e permissões de arquivo restritas.

## 2. Pré-requisitos
- Node.js >= 18.18.0 (recomendado LTS atual).
- npm ou pnpm.
- Ambiente seguro (evitar hosts comprometidos / terminais gravados).

## 3. Instalação
```bash
cd authbank-scripts
npm install
cp .env.example .env  # Ajuste a senha ou use variável de ambiente externa
```

## 4. Estrutura
```
authbank-scripts/
	package.json
	scripts/
		generateWallet.js
		decryptWallet.js
	.env.example
	wallets/ (gerado automaticamente)  # NÃO versionar
```

## 5. Geração de Carteira (`generateWallet`)
Cria uma nova carteira + mnemonic BIP39 a partir de entropia (16/24/32 bytes) e gera um keystore JSON (Web3 Secret Storage). O arquivo é salvo com permissões 600.

Opções principais:
- `--out-dir, -o` Diretório onde salvar (default: wallets)
- `--label, -l` Rótulo para compor nome do arquivo (default: timestamp ISO)
- `--strength` Entropia em bytes (16=128b, 24=192b, 32=256b)
- `--show-mnemonic` Exibe a seed (NÃO recomendado)
- `--password, -p` Fornece a senha inline (desaconselhado – preferir prompt ou env)

Fluxo de senha: flag -> `WALLET_PASSWORD` -> prompt oculto (com confirmação).

Validação de senha exige: 12+ chars, maiúscula, minúscula, dígito, caractere especial.

Criptografia: `scrypt` com parâmetros N=2^18, r=8, p=1 (pode ajustar conforme performance do host).

Exemplo:
```bash
WALLET_PASSWORD='SenhaUltraForte!123' npm run generate:wallet -- --label minha
```

## 6. Descriptografia / Validação (`decryptWallet`)
Lê o keystore JSON e tenta decriptar com a senha informada. Permite (opcional) exibir mnemonic ou chave privada.

Opções:
- `--file, -f` Caminho do keystore (obrigatório)
- `--password, -p` Senha (ou usar prompt/env)
- `--show-mnemonic` Mostra mnemonic (sensível)
- `--show-private-key` Mostra chave privada (altamente sensível)

Exemplo:
```bash
WALLET_PASSWORD='SenhaUltraForte!123' npm run decrypt:wallet -- --file wallets/minha-0x....keystore.json
```

## 9. Segurança e Boas Práticas
- NÃO reutilize senha de outros serviços.
- Evite passar `--password` na linha de comando (pode ficar em histórico / ps).
- Use password manager ou variáveis temporárias de shell.
- Faça backup offline e redundante (ex: hardware encrypted USB + cofre físico).
- Nunca exponha mnemonic, private key ou JSON criptografado em issues, commits ou logs.
- Restrinja permissões: arquivos de keystore devem ser 600 (ou 400 se somente leitura).
- Evite rodar em servidores multiusuário sem isolamento apropriado.
- Revogue/descartar carteiras comprometidas imediatamente e transfira fundos.

## 10. Exemplos de Uso
Gerar carteira pedindo senha via prompt:
```bash
npm run generate:wallet -- --label teste
```

Gerar com entropia 256 bits e exibir mnemonic (não recomendado):
```bash
WALLET_PASSWORD='SenhaUltraForte!123' npm run generate:wallet -- --strength 32 --show-mnemonic
```

Descriptografar e validar endereço:
```bash
WALLET_PASSWORD='SenhaUltraForte!123' npm run decrypt:wallet -- --file wallets/teste-0xABC...keystore.json
```

Mostrar mnemonic durante a decriptação:
```bash
WALLET_PASSWORD='SenhaUltraForte!123' npm run decrypt:wallet -- --file wallets/teste-0xABC...keystore.json --show-mnemonic
```

## 11. Comandos Úteis

### Scripts Principais
```bash
# Gerar nova carteira
npm run generate:wallet -- --label minha-carteira

# Descriptografar carteira existente
npm run decrypt:wallet -- --file wallets/minha-carteira-0x....keystore.json

# Estimar gas para mint (executa por padrão estimateGasForMintRef)
npm run gas:limit

# Estimar gas apenas para mint (alternativa específica)
npm run gas:mint

# Estimar gas para transfer
npm run gas:transfer

# Verificar roles de uma carteira
npm run role:check -- --address 0x...

# Mintar tokens
npm run mint:tokens -- --to 0x... --amount 100
```

### Utilitários de Sistema
Limpar histórico bash/zsh da última linha se digitou algo sensível:
```bash
history -d $(history | tail -n 1 | awk '{print $1}')
```

Ver permissões dos keystores:
```bash
ls -l wallets/
```

Alterar permissões para somente leitura do dono:
```bash
chmod 400 wallets/*.keystore.json
```

Benchmark (opcional) para tempo de criptografia (aprox.):
```bash
time WALLET_PASSWORD='SenhaUltraForte!123' npm run generate:wallet -- --label bench --strength 16
```

### Testes e Desenvolvimento
```bash
# Verificar sintaxe do JavaScript
node --check scripts/gasLimitCalculator.js

# Testar conexão com o contrato
node -e "import('./scripts/gasLimitCalculator.js').then(m => m.estimateGasForMintRef())"

# Verificar ABI do contrato
node -e "console.log(JSON.parse(require('fs').readFileSync('./abi/BBRLPlus.json')).filter(f => f.type === 'function').map(f => f.name))"
```

## 10. Próximos Passos Opcionais
- Integrar ESLint + Prettier.
- Adicionar suporte a derivação HD: múltiplos paths (m/44'/60'/0'/0/n).
- Suporte a exportação para hardware wallet.
- Testes automatizados (ex: vitest) para funções de utilidade.
- Opção para Argon2id em vez de scrypt (pacotes nativos exigem build).

## Aviso Legal
Uso por sua conta e risco. Verifique requisitos regulatórios e de compliance antes de manipular chaves em produção.

---
Para dúvidas ou melhorias, abrir uma issue no repositório principal.
