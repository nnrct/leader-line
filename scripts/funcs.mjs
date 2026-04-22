import { extractTestFunctions } from './toolchain.mjs';

const writtenFiles = await extractTestFunctions();

writtenFiles.forEach(filePath => {
  console.log(`Wrote ${filePath}`);
});
