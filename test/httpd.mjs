import { stat } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const DOC_ROOT = __dirname;
const PORT = Number(process.env.PORT || 8080);

const MODULE_PACKAGES = [
  'jasmine-core',
  'test-page-loader',
  'anim-event',
  'plain-draggable'
];

const packageRoots = new Map(MODULE_PACKAGES.map(packageName => [packageName, resolvePackageRoot(packageName)]));

function resolvePackageRoot(packageName) {
  const entryPath = require.resolve(packageName);
  const marker = `${path.sep}node_modules${path.sep}${packageName}${path.sep}`;
  const markerIndex = entryPath.lastIndexOf(marker);

  if (markerIndex < 0) {
    throw new Error(`Unable to resolve package root for ${packageName}`);
  }

  return entryPath.slice(0, markerIndex + marker.length - 1);
}

function log(url, status) {
  console.log(`(${url}) ${status}`);
}

function safeResolve(rootPath, requestPath) {
  const resolvedPath = path.resolve(rootPath, `.${requestPath}`);
  const relativePath = path.relative(rootPath, resolvedPath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return resolvedPath;
}

async function existingFile(filePath) {
  try {
    const stats = await stat(filePath);
    if (stats.isDirectory()) {
      return path.join(filePath, 'index.html');
    }
    return filePath;
  } catch {
    return null;
  }
}

function getLegacyFallbackPath(packageName, packagePath) {
  return packagePath === `/${packageName}.js` ?
    `/${packageName}.min.js` :
    null;
}

async function toFilePath(requestPath) {
  const decodedPath = decodeURIComponent(requestPath);
  const moduleAliasMatch = /^\/([^/]+)(\/.*)?$/.exec(decodedPath);
  const nodeModulesMatch = /^\/node_modules\/([^/]+)(\/.*)?$/.exec(decodedPath);
  let packageName;
  let packagePath;
  let resolvedPath;

  if (nodeModulesMatch && packageRoots.has(nodeModulesMatch[1])) {
    packageName = nodeModulesMatch[1];
    packagePath = nodeModulesMatch[2] || '/';
    resolvedPath = safeResolve(packageRoots.get(packageName), packagePath);
  } else if (moduleAliasMatch && packageRoots.has(moduleAliasMatch[1])) {
    packageName = moduleAliasMatch[1];
    packagePath = moduleAliasMatch[2] || '/';
    resolvedPath = safeResolve(packageRoots.get(packageName), packagePath);
  } else if (decodedPath === '/src' || decodedPath.startsWith('/src/')) {
    resolvedPath = safeResolve(ROOT_DIR, decodedPath);
  } else {
    resolvedPath = safeResolve(DOC_ROOT, decodedPath);
  }

  if (!resolvedPath) {
    return null;
  }

  const directPath = await existingFile(resolvedPath);
  if (directPath) {
    return directPath;
  }

  if (packageName && packagePath) {
    const fallbackPath = getLegacyFallbackPath(packageName, packagePath);
    if (fallbackPath) {
      return existingFile(safeResolve(packageRoots.get(packageName), fallbackPath));
    }
  }

  return null;
}

const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);
    const filePath = await toFilePath(url.pathname);

    if (!filePath) {
      log(url.pathname, 404);
      return new Response('Not Found', {
        headers: { 'Cache-Control': 'no-cache, must-revalidate' },
        status: 404
      });
    }

    log(url.pathname, 200);
    return new Response(Bun.file(filePath), {
      headers: { 'Cache-Control': 'no-cache, must-revalidate' }
    });
  }
});

console.log(`START: ${server.url}`);
console.log(`ROOT: ${DOC_ROOT}`);
console.log('(^C to stop)');
