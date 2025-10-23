# Projeto Reward Distributor (TokenA -> TokenB) - Modelo apresentado dia 23/10

## Visão Geral

## Passo a Passo Completo

### 1. Preparação e Verificação de Ambiente

Requisitos:

- Node.js LTS instalado (>=18)
- NPM instalado
- Git opcional

Verifique versões:

```cmd
node -v
npm -v
```

Clone/Recrie o projeto e instale dependências:

```cmd
npm install --legacy-peer-deps
```

### 2. Iniciar Rede Local Hardhat

Abra um terminal:

```cmd
npx hardhat node
```

Deixe rodando. Isso cria uma blockchain local em localhost:8545 e mostra 20 contas com chaves.

### 3. Deploy dos Contratos

Em outro terminal (sem parar o node):

```cmd
npx hardhat run scripts/deploy_local.ts --network localhost
```

Saída esperada: 3 endereços (TokenA, TokenB, RewardDistributor).
Anote-os ou exporte em `.env`:

```
REWARD_ADDRESS=0x...
TOKENA_ADDRESS=0x...
TOKENB_ADDRESS=0x...
```

### 4. Verificações Iniciais

Abra console Hardhat:

```cmd
npx hardhat console --network localhost
```

Dentro dele:

```typescript
const reward = await ethers.getContractAt(
  "RewardDistributor",
  process.env.REWARD_ADDRESS
);
await reward.participantsCount(); // deve estar 0 inicialmente se não adicionou no deploy
```

### 5. Setup de Participants e Mint Inicial

Opcional: usar script pronto:

```cmd
npx hardhat run scripts/setup.ts --network localhost
```

Isso adiciona três participantes e distribui TokenA para eles.

Manual (console):

```typescript
const tokenA = await ethers.getContractAt("TokenA", process.env.TOKENA_ADDRESS);
const [, , u1, u2, u3] = await ethers.getSigners();
await reward.addParticipant(u1.address);
await reward.addParticipant(u2.address);
await reward.addParticipant(u3.address);
await tokenA.transfer(u1.address, ethers.parseEther("100"));
await tokenA.transfer(u2.address, ethers.parseEther("35"));
await tokenA.transfer(u3.address, ethers.parseEther("60"));
```

### 6. Teste Principal (Fluxo Básico)

Disparo manual:

```typescript
await reward.manualTrigger(); // ou triggerManual()
```

Verificar saldos:

```typescript
const tokenB = await ethers.getContractAt("TokenB", process.env.TOKENB_ADDRESS);
await tokenB.balanceOf(u1.address); // ~ 50 (50% de 100)
await tokenB.balanceOf(u2.address); // ~ 17.5 (exemplo se percentual mudar)
await tokenB.balanceOf(u3.address); // ~ 30 (50% de 60)
```

### 7. Teste de autoTrigger (Por Bloco)

Verifique próximo bloco alvo:

```typescript
await reward.nextTriggerBlock();
await reward.canTrigger(); // false
```

Avance blocos artificialmente (em script):

```cmd
npx hardhat run scripts/trigger.ts --network localhost
```

Ou manual no console:

```typescript
for (let i = 0; i < 60; i++) {
  await ethers.provider.send("evm_mine", []);
}
await reward.autoTrigger(); // alias triggerIfInterval()
```

### 8. Verificação de Permissões

- Apenas endereço com `OPERATOR_ROLE` adiciona participantes / trigger manual.
- Apenas `DEFAULT_ADMIN_ROLE` altera percent/intervalo.
- Ownership de `TokenB` é o contrato Reward (verifique `await tokenB.owner()`).

### 9. Comandos Úteis (Cole e Cole)

```cmd
:: Node local
npx hardhat node
:: Deploy
npx hardhat run scripts/deploy_local.ts --network localhost
:: Setup
npx hardhat run scripts/setup.ts --network localhost
:: Inspect (estado atual)
npx hardhat run scripts/inspect.ts --network localhost
:: Trigger manual
npx hardhat console --network localhost
:: Testes
npx hardhat test
```

### 10. Testes de Borda

- Participante com saldo 0: não receberá mint.
- Segundo trigger no mesmo bloco: reverte com "Already distributed this block".
- Percentual > 100%: reverte.
- Pausa TokenB: `manualTrigger()`/`autoTrigger()` revert.
- Remover participante e disparar: não deve receber recompensa.

### 11. Logs / Eventos

Escute eventos no console:

```typescript
reward.on("RewardPaid", (acct, balanceA, amount, pct) =>
  console.log("RewardPaid", acct, balanceA.toString(), amount.toString(), pct)
);
reward.on("RewardTriggered", (bn, pct, count) =>
  console.log("Triggered", bn.toString(), pct, count.toString())
);
```

### 12. Checklist Final

Marque cada item:

```
[ ] npx hardhat node rodando.
[ ] npx hardhat run scripts/deploy_local.ts --network localhost devolveu 3 endereços.
[ ] tokenB.owner() === rewardAddress.
[ ] reward.setTokens(tokenA, tokenB) executado (se necessário).
[ ] scripts/setup.ts executado (mint + participants).
[ ] reward.getParticipantsCount() > 0.
[ ] reward.manualTrigger() resultou em TokenB balances corretos (50% do saldo TokenA).
[ ] autoTrigger() disparado após avançar blocos e validou novos TokenB.
[ ] npx hardhat test passou.
[ ] inspeção de eventos e tx receipts realizada.
```

Se todos marcados: fluxo validado.

Este projeto demonstra um contrato de recompensa que minta TokenB para um conjunto de carteiras baseado em um percentual do saldo atual de TokenA que cada carteira possui. Há dois modos de disparo:

1. Manual (operador chama a função)
2. Automático por intervalo de blocos (quando o número de blocos transcorridos atinge `blockInterval`).

Tokens usados:

- TokenA: ERC20 padrão com supply inicial mintado para o deployer.
- TokenB: ERC20 com função de mint controlada via AccessControl (MINTER_ROLE).

Contrato RewardDistributor:

- Armazena conjunto de participantes (EnumerableSet) que receberão recompensas.
- Calcula recompensa: `reward = balanceA * rewardPercentBps / 10000` e faz mint de TokenB.
- `rewardPercentBps`: percentual em basis points (5000 = 50%).
- `blockInterval`: intervalo mínimo de blocos entre disparos automáticos.
- Roles: `DEFAULT_ADMIN_ROLE` e `OPERATOR_ROLE` (apenas operador adiciona/remove participantes e dispara manual).

## Pré-requisitos

- Node.js LTS instalado.
- Criar arquivo `.env` baseado em `.env.example` para deploy em testnet.

## Instalação

```cmd
npm install
```

## Compilar

```cmd
npm run compile
```

## Testar

```cmd
npm test
```

## Scripts TypeScript

Scripts principais em TypeScript: `deploy_local.ts`, `deploy_testnet.ts`, `interact.ts`.
Exemplo de deploy local:

```cmd
npx hardhat run scripts/deploy_local.ts --network hardhat
```

Script de interação (use variáveis de ambiente ou `.env` carregado automaticamente se referenciado no script):

```cmd
set REWARD_ADDRESS=0x...
set TOKENA_ADDRESS=0x...
set TOKENB_ADDRESS=0x...
npx hardhat run scripts/interact.ts --network sepolia
```

Você pode criar script adicional para prever recompensas (ex: `scripts/preview.ts`) utilizando as funções de preview descritas abaixo.

## Funções de Pause

Tokens `TokenA` e `TokenB` possuem `pause()` e `unpause()` controlados por `PAUSER_ROLE`. Enquanto pausado:

- `TokenA`: bloqueia transferências.
- `TokenB`: bloqueia transferências e também o `mint()` usado pelo RewardDistributor.

Se `TokenB` estiver pausado, um disparo de recompensa irá reverter com `"TokenB paused"`.

## Deploy em rede Hardhat local

Inicie o nó interno (opcional se usar "--network hardhat" ele instancia ephemeral):

```cmd
npx hardhat node
```

Em outro terminal, execute deploy:

```cmd
npm run deploy:local
```

Saída irá mostrar endereços dos contratos. Para acionar manual:

```cmd
npx hardhat console --network hardhat
```

Dentro do console:

```js
const reward = await ethers.getContractAt(
  "RewardDistributor",
  "ENDERECO_REWARD"
);
await reward.triggerManual();
```

Verificar saldos:

```js
const tokenB = await ethers.getContractAt("TokenB", "ENDERECO_TOKENB");
(await tokenB.balanceOf("CARTEIRA_USER1")).toString();
```

## Deploy em Sepolia

Configure `.env` com `PRIVATE_KEY` e `ALCHEMY_API_KEY`.

```cmd
npm run deploy:testnet
```

## Ajustar Percentual e Intervalo

```js
await reward.setRewardPercentBps(4000); // 40%
await reward.setBlockInterval(7200); // novo intervalo
```

## Disparo Automático & Guarda de Duplicidade

O contrato controla o intervalo usando `blockInterval` e `lastTriggerBlock`.

- `canTrigger()` retorna `true` se `block.number >= lastTriggerBlock + blockInterval`.
- `triggerIfInterval()` exige essa condição ou reverte com `"Interval not reached"`.
- Distribuições (manual ou automática) incluem guarda adicional: `require(block.number > lastTriggerBlock, "Already distributed this block")` evitando duas distribuições no mesmo bloco.

Em testes, para verificar a guarda sem avançar bloco, utilize `staticCall` (ethers v6) em vez de executar uma transação real:

```ts
await expect(reward.triggerManual.staticCall()).to.be.revertedWith(
  "Already distributed this block"
);
```

## Eventos Importantes

- `RewardTriggered(blockNumber, percentBps, participantsCount)`
- `ParticipantAdded(account)` / `ParticipantRemoved(account)`
- `PercentUpdated(oldValue, newValue)` / `BlockIntervalUpdated(oldValue, newValue)`

## Preview de Recompensas (Estimativa off-chain)

Funções disponíveis para simular recompensas antes de disparar:

```solidity
function previewUserReward(address user) view returns (uint256 balanceA, uint256 rewardAmount);
function previewAllRewards() view returns (address[] accounts, uint256[] rewards);
```

Uso no console Hardhat:

```ts
const [accounts, rewards] = await reward.previewAllRewards();
accounts.forEach((a, i) => console.log(a, ethers.formatEther(rewards[i])));
```

Isso ajuda a verificar o impacto do percentual atual (`rewardPercentBps`) antes de executar `triggerManual()`.

## Segurança e Extensões Futuras

- AccessControl restringe funções sensíveis (admin e operador).
- Limite máximo de participantes (`maxParticipants`).
- Guarda de duplicidade por bloco evita front-running de triggers repetidos.
- Pausable nos tokens para emergências.
- Possível adicionar: oráculo anti-manipulação de saldo, time-lock para mudanças de parâmetros, fee de protocolo.

## Lint (ESLint)

Após instalação das dependências, rode:

```cmd
npm run lint
```

Configurações ignoram diretórios gerados (`artifacts/`, `cache/`, `typechain-types/`). Ajuste regras em `.eslintrc.js` conforme necessidade.

## Gas Reporter

Para ver custos de gas nos testes, habilite a variável de ambiente `REPORT_GAS=1`:

```cmd
set REPORT_GAS=1
npm test
```

Isso exibirá um resumo de custos de gas por função.

## Parametrização

Crie múltiplos contratos RewardDistributor com diferentes `rewardPercentBps` e `blockInterval` conforme necessidade.

## Verificação Etherscan (opcional)

Preencha `ETHERSCAN_API_KEY` e:

```cmd
npx hardhat verify --network sepolia ENDERECO_REWARD "ENDERECO_TOKENA" "ENDERECO_TOKENB" 5000 6400
```

## Estrutura

```
contracts/
  interfaces/
    IMintableERC20.sol
  token/
    TokenA.sol
  reward/
    RewardDistributor.sol
scripts/
  deploy_local.ts
  deploy_testnet.ts
  interact.ts
test/
  reward.ts
hardhat.config.ts
README.md
```

## Uso no Remix IDE (Online) - https://remix.ethereum.org/

Você pode copiar a pasta `contracts` diretamente para o Remix.

1. Crie arquivos conforme a estrutura acima.
2. Certifique-se de selecionar compilador 0.8.24 e ativar optimizer (runs 200).
3. Compile primeiro `interfaces/IMintableERC20.sol`, depois `token/TokenA.sol`, `token/TokenB.sol`, e por fim `reward/RewardDistributor.sol`.
4. Faça deploy de `TokenA` passando o supply inicial.
5. Deploy de `TokenB`.
6. Deploy de `RewardDistributor` usando endereços de TokenA, TokenB, percentBps e blockInterval.
7. Chame `grantRole(MINTER_ROLE, addressReward)` no TokenB (ou use script fornecido aqui no Hardhat) para conceder poder de mint.
8. Adicione participantes com `addParticipant(address)`.
9. Dispare manual `triggerManual()` ou aguarde intervalo e use `triggerIfInterval()`.

## Checklist Rápido

1. `npm install` (se houver problemas, limpar `node_modules` e `package-lock.json` e repetir)
2. `npm run compile`
3. `npm test`
4. `npm run deploy:local`
5. Console: trigger e verificar saldos
6. Deploy testnet (opcional)

## Licença

MIT
