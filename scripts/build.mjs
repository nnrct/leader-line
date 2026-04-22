import { transform } from 'esbuild';
import { DEST_BROWSER_PATH, DEST_ESM_PATH, createBuildSource } from './toolchain.mjs';
import { writeFile } from 'node:fs/promises';

const { banner, source } = await createBuildSource();

const classicBuild = await transform(source, {
  legalComments: 'none',
  minify: true,
  target: 'es5'
});

const esmBuild = await transform(`${source}\nexport default LeaderLine;\nexport { LeaderLine };\n`, {
  format: 'esm',
  legalComments: 'none',
  minify: true,
  target: 'es2018'
});

await writeFile(DEST_BROWSER_PATH, `${banner}${classicBuild.code}`);
await writeFile(DEST_ESM_PATH, `${banner}${esmBuild.code}`);

console.log(`Built ${DEST_BROWSER_PATH}`);
console.log(`Built ${DEST_ESM_PATH}`);
