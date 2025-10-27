// Script para remover arquivos .s.sol e .t.sol das pastas contracts/ e subpastas
// Este script é chamado automaticamente antes do npm run compile (precompile)
const fs = require('fs');
const path = require('path');

function removeFilesByExtension(dir, exts) {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      removeFilesByExtension(fullPath, exts);
    } else if (exts.some((ext) => file.endsWith(ext))) {
      fs.unlinkSync(fullPath);
      console.log('Removido:', fullPath);
    }
  }
}

removeFilesByExtension(path.join(__dirname, '../contracts'), ['.s.sol', '.t.sol']);
removeFilesByExtension(path.join(__dirname, '../contracts/test'), ['.sol']);
console.log('Limpeza de arquivos Foundry concluída.');
