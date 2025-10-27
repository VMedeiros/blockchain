# Scripts Foundry

Esta pasta contém scripts Solidity (.s.sol) e testes (.t.sol) que utilizam forge-std e são executados exclusivamente com Foundry.

## Como usar

1. Instale o Foundry: https://book.getfoundry.sh/getting-started/installation
2. Instale as dependências:
   ```bash
   forge install
   ```
3. Execute scripts:
   ```bash
   forge script foundry-scripts/NOME_DO_SCRIPT.s.sol --fork-url <URL_RPC> --broadcast
   ```

> Não coloque arquivos .s.sol ou .t.sol na pasta `contracts/` para evitar conflitos com o Hardhat.

## Exemplos de scripts

- AdminBBRLPlus.s.sol
- DeployBBRLPlus.s.sol
- ExampleUsageBBRLPlus.s.sol
- InteractBBRLPlus.s.sol
- QueryBBRLPlus.s.sol
- PaymentGroup_DeployPaymentGroup.s.sol
- PaymentGroupFactory_DeployPaymentGroupFactory.s.sol

---

> **Atenção:** Scripts nesta pasta são para automação avançada, administração e testes de integração com Foundry. Eles não são executados nem testados automaticamente no CI. Use-os manualmente conforme necessário.
