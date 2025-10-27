# Projeto Reward Distributor (TokenA -> TokenB)

## Pré-requisitos

- Node.js LTS instalado.
- Criar arquivo `.env` baseado em `.env.example` para deploy em testnet.

## Instalação

```bash
npm install
```

## Compilar

```bash
npm run compile
```

## Testar

```bash
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
  clean_foundry_artifacts.js
test/
  reward.ts
foundry-scripts/
  AdminBBRLPlus.s.sol
  DeployBBRLPlus.s.sol
  ...
hardhat.config.ts
README.md
```

## Observações importantes

- **Scripts e testes Foundry:** Todos os arquivos `.s.sol` e `.t.sol` devem ficar em `foundry-scripts/` e nunca em `contracts/` para evitar conflitos de compilação com o Hardhat.
- **Deploy e testes automatizados:** Use Hardhat para deploy e testes TypeScript. Use Foundry apenas para scripts Solidity avançados e automação administrativa.
- Consulte o `foundry-scripts/README.md` para instruções de uso dos scripts Foundry.
- **Limpeza automática:** O script de limpeza de artefatos Foundry roda automaticamente antes do `npm run compile`. Se necessário, execute manualmente:
  ```bash
  node scripts/clean_foundry_artifacts.js
  ```
  Isso garante que nenhum arquivo `.s.sol` ou `.t.sol` residual cause erro de compilação.
- **Padronização:** Use `npm run lint` para checar o padrão do código e `npx prettier --write .` para formatar.

## Automação e qualidade

- CI configurado em `.github/workflows/ci.yml` para build, lint, compile e testes automáticos em todo push/PR.
- Husky roda lint antes de cada commit.
- Prettier para padronização de código (`.prettierrc` e `.prettierignore`).

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
