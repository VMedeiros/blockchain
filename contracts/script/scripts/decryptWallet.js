#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { Wallet } from 'ethers';
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('file', { alias: 'f', type: 'string', describe: 'Caminho do arquivo keystore JSON', demandOption: true })
  .option('password', { alias: 'p', type: 'string', describe: 'Senha da carteira (evite passar via CLI)' })
  .option('show-mnemonic', { type: 'boolean', default: false, describe: 'Exibe o mnemonic da carteira (altamente sensível)' })
  .option('show-private-key', { type: 'boolean', default: false, describe: 'Exibe a chave privada (NÃO recomendado)' })
  .strict()
  .help()
  .argv;

async function promptHidden(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => {
    process.stdin.on('data', char => {
      char = char + '';
      if (['\n', '\r', '\u0004'].includes(char)) {
        process.stdout.write('\n');
      } else {
        process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(query + Array(rl.line.length + 1).join('*'));
      }
    });
    rl.question(query, (value) => {
      rl.history = rl.history.slice(1);
      rl.close();
      resolve(value);
    });
  });
}

async function main() {
  const filePath = path.resolve(process.cwd(), argv.file);
  if (!fs.existsSync(filePath)) {
    console.error('Arquivo não encontrado:', filePath);
    process.exit(1);
  }

  // Verifica permissões do arquivo (ideal 600 ou 400)
  try {
    const stat = fs.statSync(filePath);
    const perms = stat.mode & 0o777;
    if (![0o600, 0o400].includes(perms)) {
      console.warn(`Aviso: permissões do arquivo são ${perms.toString(8)}. Recomenda-se 600 ou 400.`);
    }
  } catch (e) {
    console.warn('Não foi possível inspecionar permissões do arquivo:', e.message);
  }

  let password = argv.password || process.env.WALLET_PASSWORD;
  if (!password) {
    password = await promptHidden('Informe a senha: ');
  }

  const encryptedJson = fs.readFileSync(filePath, 'utf8');

  try {
    const wallet = await Wallet.fromEncryptedJson(encryptedJson, password);
    console.log('Carteira descriptografada com sucesso.');
    console.log('Endereço:', wallet.address);

    if (argv['show-mnemonic']) {
      try {
        const mnemonic = wallet.mnemonic?.phrase;
        if (mnemonic) {
          console.warn('ATENÇÃO: Exibindo mnemonic. Proteja esta informação.');
            console.log('Mnemonic:', mnemonic);
        } else {
          console.log('Nenhum mnemonic associado (pode ter sido criado sem frase).');
        }
      } catch (e) {
        console.warn('Não foi possível recuperar o mnemonic:', e.message);
      }
    } else {
      console.log('Use --show-mnemonic para exibir a seed (não recomendado).');
    }

    if (argv['show-private-key']) {
      console.warn('ATENÇÃO: Exibindo chave privada. NÃO compartilhe.');
      console.log('PrivateKey:', wallet.privateKey);
    } else {
      console.log('Use --show-private-key somente se absolutamente necessário.');
    }

    console.log('\nBoas práticas:');
    console.log('- Evite rodar em máquinas comprometidas ou ambientes compartilhados.');
    console.log('- Limpe variáveis de ambiente que contenham senhas após o uso.');
    console.log('- Não armazene senhas em plain text dentro de scripts.');
  } catch (err) {
    console.error('Falha na descriptografia. Senha incorreta ou arquivo inválido.');
    console.error(err.message);
    process.exit(2);
  }
}

main().catch(err => {
  console.error('Erro inesperado:', err);
  process.exit(1);
});
