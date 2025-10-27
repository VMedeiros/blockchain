#!/usr/bin/env node
import { Wallet, Mnemonic, randomBytes } from 'ethers';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import 'dotenv/config';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const argv = yargs(hideBin(process.argv))
  .option('password', { alias: 'p', type: 'string', describe: 'Senha da carteira (NÃO recomendado passar via CLI).', demandOption: false })
  .option('out-dir', { alias: 'o', type: 'string', describe: 'Diretório de saída para salvar o JSON criptografado.', default: 'wallets' })
  .option('label', { alias: 'l', type: 'string', describe: 'Rótulo identificador da carteira.', default: () => new Date().toISOString().replace(/[:.]/g, '-') })
  .option('show-mnemonic', { type: 'boolean', default: false, describe: 'Exibe o mnemonic no final (use com EXTREMO cuidado).' })
  .option('strength', { type: 'number', default: 32, describe: 'Bytes de entropia (16, 24, 32). 32 = 256 bits.' })
  .option('dry-run', { type: 'boolean', default: false, describe: 'Executa geração e criptografia apenas em memória (não cria arquivo).' })
  .strict()
  .help()
  .argv;

function checkPasswordStrength(password) {
  const issues = [];
  if (password.length < 12) issues.push('mínimo de 12 caracteres');
  if (!/[A-Z]/.test(password)) issues.push('1 letra maiúscula');
  if (!/[a-z]/.test(password)) issues.push('1 letra minúscula');
  if (!/[0-9]/.test(password)) issues.push('1 dígito');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('1 caractere especial');
  return issues;
}

async function promptHidden(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return await new Promise((resolve) => {
    const stdin = process.openStdin();
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
  // Obter senha de: CLI flag -> ENV -> prompt seguro
  let password = argv.password || process.env.WALLET_PASSWORD;
  if (!password) {
    password = await promptHidden('Defina uma senha forte para a carteira: ');
    const confirm = await promptHidden('Repita a senha: ');
    if (password !== confirm) {
      console.error('As senhas não coincidem. Abortando.');
      process.exit(1);
    }
  }

  const issues = checkPasswordStrength(password);
  if (issues.length) {
    console.error('Senha fraca. Requisitos faltantes: ' + issues.join(', '));
    process.exit(1);
  }

  const allowedStrength = [16,24,32];
  if (!allowedStrength.includes(argv.strength)) {
    console.error('Valor de --strength inválido. Use 16, 24 ou 32.');
    process.exit(1);
  }

  const entropy = randomBytes(argv.strength);
  let mnemonic;
  try {
    if (Mnemonic && typeof Mnemonic.fromEntropy === 'function') {
      mnemonic = Mnemonic.fromEntropy(entropy).phrase;
    } else {
      throw new Error('Mnemonic.fromEntropy indisponível');
    }
  } catch (e) {
    console.warn('Fallback: usando Wallet.createRandom() pois conversão direta de entropia não está disponível nesta versão de ethers. Detalhe:', e.message);
    // createRandom sempre usa 16 bytes internos + extraEntropy opcional; passamos nossa entropia como extra para reforço.
    const tmp = Wallet.createRandom({ extraEntropy: entropy });
    mnemonic = tmp.mnemonic?.phrase || tmp.mnemonic; // compat
  }
  const wallet = Wallet.fromPhrase(mnemonic);

  // ethers v6: wallet.encrypt(password, progressCallback?)
  const encrypted = await wallet.encrypt(password, (progress) => {
    if (progress === 1) return; // evita poluir saída ao final
    if (progress % 0.1 < 0.0001) {
      process.stdout.write(`Criptografando (scrypt) ${(progress * 100).toFixed(0)}%...\r`);
    }
  });
  process.stdout.write('\n');

  // Validação round-trip em memória: decrypt e reimporta para garantir consistência
  let decryptedWallet;
  try {
    decryptedWallet = await Wallet.fromEncryptedJson(encrypted, password);
    if (decryptedWallet.address !== wallet.address) {
      throw new Error('Endereço divergente após decrypt');
    }
  } catch (e) {
    console.error('Falha ao validar decrypt do keystore em memória:', e.message);
    process.exit(1);
  }

  if (argv['dry-run']) {
    console.log('Dry-run concluído com sucesso. Nenhum arquivo foi criado.');
    console.log('Endereço: ', wallet.address);
    if (argv['show-mnemonic']) {
      console.warn('ATENÇÃO: Exibindo mnemonic (dry-run).');
      console.log('Mnemonic:', mnemonic);
    }
    return; // encerra antes de salvar
  }

  const outDir = path.resolve(process.cwd(), argv['out-dir']);
  fs.mkdirSync(outDir, { recursive: true, mode: 0o700 });

  const fileName = `${argv.label}-${wallet.address}.keystore.json`;
  const outPath = path.join(outDir, fileName);

  // Evitar overwrite acidental
  if (fs.existsSync(outPath)) {
    console.error('Arquivo já existe: ' + outPath);
    process.exit(1);
  }

  fs.writeFileSync(outPath, encrypted, { mode: 0o600, flag: 'wx' });

  // Revalida permissões (alguns FS podem mascarar)
  try {
    const stat = fs.statSync(outPath);
    const perms = stat.mode & 0o777;
    if (perms !== 0o600) {
      console.warn(`Ajustando permissões do arquivo (atual ${perms.toString(8)}) para 600.`);
      fs.chmodSync(outPath, 0o600);
    }
  } catch (e) {
    console.warn('Não foi possível validar permissões do arquivo:', e.message);
  }

  console.log('Carteira gerada com sucesso.');
  console.log('Endereço: ', wallet.address);
  console.log('Arquivo salvo em: ', outPath);
  console.log('NUNCA compartilhe este arquivo ou a senha. Faça backup seguro offline.');

  if (argv['show-mnemonic']) {
    console.warn('ATENÇÃO: Exibindo mnemonic. Certifique-se de que não está gravando logs.');
    console.log('Mnemonic:', mnemonic);
  } else {
    console.log('Para ver o mnemonic, rode novamente com --show-mnemonic (não recomendado).');
  }

  console.log('\nDicas de segurança:');
  console.log('- Faça backup offline (criptografado) do arquivo keystore + mnemonic em local seguro.');
  console.log('- NÃO reutilize a mesma senha de outros serviços.');
  console.log('- Considere usar um password manager para armazenar a senha.');
  console.log('- Evite usar --password na linha de comando (pode aparecer em histórico).');
}

main().catch(err => {
  console.error('Erro ao gerar carteira:', err);
  process.exit(1);
});
