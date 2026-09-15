import { build } from 'esbuild';
import { readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sourceFiles = ['server.js'];
for (const directory of ['public', 'src']) {
  for (const file of await readdir(directory, { recursive: true })) {
    if (file.endsWith('.js')) sourceFiles.push(`${directory}/${file}`);
  }
}
for (const file of sourceFiles) execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });

// Pages serve public/ diretamente. Importar um pacote npm aqui quebra o formulário.
await build({
  entryPoints: ['public/app.js', 'public/home.js', 'public/result.js'],
  outdir: '_site-check', bundle: true, platform: 'browser', format: 'esm', write: false,
  plugins: [{ name: 'pages-relative-imports', setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, args => {
      if (args.kind !== 'entry-point') return { errors: [{ text: `Import incompatível com Pages: ${args.path} em ${args.importer}. Use um arquivo local em public/.` }] };
    });
  } }]
});
console.log('Sintaxe e imports das três páginas verificados.');
