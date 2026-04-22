import { writeDefsFiles } from './toolchain.mjs';

const { defsPath, symbolsPath } = await writeDefsFiles();

console.log(`Wrote ${defsPath}`);
console.log(`Wrote ${symbolsPath}`);
