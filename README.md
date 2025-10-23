# Projeto Reward Distributor (TokenA -> TokenB) - Modelo apresentado dia 23/10

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
