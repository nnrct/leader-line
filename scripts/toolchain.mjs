import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const cheerio = require('cheerio');
const htmlclean = require('htmlclean');
const CleanCSS = require('clean-css');
const preProc = require('pre-proc');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');
export const SRC_DIR = path.join(ROOT_DIR, 'src');
export const DEST_BROWSER_PATH = path.join(ROOT_DIR, 'leader-line.min.js');
export const DEST_ESM_PATH = path.join(ROOT_DIR, 'leader-line.mjs');

const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const LEADER_LINE_SOURCE_PATH = path.join(SRC_DIR, 'leader-line.js');
const DEFS_PATH = path.join(SRC_DIR, 'defs.js');
const SYMBOLS_HTML_PATH = path.join(SRC_DIR, 'symbols.html');
const SYMBOLS_JSON_PATH = path.join(SRC_DIR, 'symbols.json');
const CSS_PATH = path.join(SRC_DIR, 'leader-line.css');

const PACK_LIBS = [
  ['anim', 'anim.js'],
  ['pathDataPolyfill', 'path-data-polyfill/path-data-polyfill.js'],
  ['AnimEvent', '../node_modules/anim-event/anim-event.min.js', /^[^]*?var\s+AnimEvent\s*=\s*([^]*)\s*;\s*$/]
];

const APP_ID = 'leader-line';
const DEFS_ID = `${APP_ID}-defs`;
const DEFAULT_LINE_SIZE = 4;
const DEFINED_VAR = {
  PLUG_BEHIND: 'behind'
};

const RE_EXPORT = /^[\s\S]*?@EXPORT@\s*(?:\*\/\s*)?([\s\S]*?)\s*(?:\/\*\s*|\/\/\s*)?@\/EXPORT@[\s\S]*$/;
const RE_TEST_FUNC_EXPORT =
  /@EXPORT\[file:([^\n]+?)\]@\s*(?:\*\/\s*)?([\s\S]*?)\s*(?:\/\*\s*|\/\/\s*)?@\/EXPORT@/g;

function minifyCss(content) {
  return (new CleanCSS({ level: { 1: { specialComments: 0 } } })).minify(content).styles;
}

function serializeCode(value) {
  let matches;
  return typeof value === 'object' ?
      `{${Object.keys(value).map(prop => `${prop}:${serializeCode(value[prop])}`).join(',')}}` :
    typeof value === 'string' ? (
      (matches = /^\f(.+)\x07$/.exec(value)) ? // eslint-disable-line no-control-regex
        matches[1] : `'${value}'`
    ) : value;
}

function getDefinedVarMap() {
  return Object.keys(DEFINED_VAR).reduce((definedVar, varName) => {
    definedVar[varName] = `\f${varName}\x07`;
    return definedVar;
  }, {});
}

export async function loadPackageJson() {
  return JSON.parse(await readFile(PACKAGE_JSON_PATH, 'utf8'));
}

export async function generateDefsArtifacts() {
  const definedVar = getDefinedVarMap();
  const code = {};
  const symbolsHtml = await readFile(SYMBOLS_HTML_PATH, 'utf8');
  const $ = cheerio.load(symbolsHtml);
  let defsSrc = '';
  const codeSrc = {
    SYMBOLS: {},
    PLUG_KEY_2_ID: { behind: definedVar.PLUG_BEHIND },
    PLUG_2_SYMBOL: {}
  };

  $('svg').each((index, element) => {
    const symbol = $('.symbol', element);
    const size = $('.size', element);
    const id = symbol.attr('id');
    let noOverhead = false;
    let outlineBase;
    let outlineMax;

    if (!symbol.length || !size.length || !id) {
      return;
    }

    const elmId = `${APP_ID}-${id}`;
    const props = String(symbol.attr('class') || '').split(' ');
    defsSrc += $.xml(symbol.attr('id', elmId).removeAttr('class'));

    codeSrc.SYMBOLS[id] = { elmId };
    props.forEach(prop => {
      let matches;
      if ((matches = prop.match(/prop\-([^\s]+)/))) {
        codeSrc.SYMBOLS[id][matches[1]] = true;
      } else if ((matches = prop.match(/varId\-([^\s]+)/))) {
        codeSrc[matches[1]] = id;
      } else if (prop === 'no-overhead') {
        noOverhead = true;
      }
    });

    const bBox = codeSrc.SYMBOLS[id].bBox = {
      left: parseFloat(size.attr('x')),
      top: parseFloat(size.attr('y')),
      width: parseFloat(size.attr('width')),
      height: parseFloat(size.attr('height'))
    };
    bBox.right = bBox.left + bBox.width;
    bBox.bottom = bBox.top + bBox.height;

    codeSrc.SYMBOLS[id].widthR = bBox.width / DEFAULT_LINE_SIZE;
    codeSrc.SYMBOLS[id].heightR = bBox.height / DEFAULT_LINE_SIZE;
    codeSrc.SYMBOLS[id].bCircle = Math.max(-bBox.left, -bBox.top, bBox.right, bBox.bottom);
    codeSrc.SYMBOLS[id].sideLen = Math.max(-bBox.top, bBox.bottom);
    codeSrc.SYMBOLS[id].backLen = -bBox.left;
    codeSrc.SYMBOLS[id].overhead = noOverhead ? 0 : bBox.right;

    if ((outlineBase = $('.outline-base', element)).length && (outlineMax = $('.outline-max', element)).length) {
      codeSrc.SYMBOLS[id].outlineBase = parseFloat(outlineBase.attr('stroke-width')) / 2;
      codeSrc.SYMBOLS[id].outlineMax =
        parseFloat(outlineMax.attr('stroke-width')) / 2 / codeSrc.SYMBOLS[id].outlineBase;
    }

    codeSrc.PLUG_KEY_2_ID[id] = id;
    codeSrc.PLUG_2_SYMBOL[id] = id;
  });

  const css = await readFile(CSS_PATH, 'utf8');
  const cssSrc = minifyCss(css.trim().replace(/^\s*@charset\s+[^;]+;/gm, ''));

  defsSrc = defsSrc.replace(/<([^>\s]+)([^>]*)><\/\1>/g, '<$1$2/>');
  code.DEFS_HTML = '\'' +
    htmlclean(`<svg xmlns="http://www.w3.org/2000/svg" version="1.1" id="${DEFS_ID}">` +
        `<style><![CDATA[${cssSrc}]]></style><defs>${defsSrc}</defs></svg>`)
      .replace(/\'/g, '\\\'') + '\'';
  Object.keys(DEFINED_VAR).forEach(codeVar => { code[codeVar] = serializeCode(DEFINED_VAR[codeVar]); });
  Object.keys(codeSrc).forEach(codeVar => { code[codeVar] = serializeCode(codeSrc[codeVar]); });

  const defsScript = `var ${Object.keys(code).map(codeVar => `${codeVar}=${code[codeVar]}`).join(',')};`;

  return {
    code,
    defsScript,
    symbols: codeSrc.SYMBOLS
  };
}

export async function writeDefsFiles() {
  const artifacts = await generateDefsArtifacts();
  await writeFile(DEFS_PATH, artifacts.defsScript);
  await writeFile(SYMBOLS_JSON_PATH, JSON.stringify(artifacts.symbols));
  return {
    defsPath: DEFS_PATH,
    symbolsPath: SYMBOLS_JSON_PATH,
    code: artifacts.code
  };
}

async function getPackedLibCode() {
  const code = {};

  for (const [key, relativePath, exportPattern] of PACK_LIBS) {
    const filePath = path.join(SRC_DIR, relativePath);
    const source = await readFile(filePath, 'utf8');
    code[key] = source.replace(exportPattern || RE_EXPORT, '$1');
  }

  return code;
}

export async function createBuildSource() {
  const pkg = await loadPackageJson();
  const { code: defsCode } = await writeDefsFiles();
  const code = {
    ...defsCode,
    ...await getPackedLibCode()
  };

  const source = await readFile(LEADER_LINE_SOURCE_PATH, 'utf8');
  const packedSource = preProc.removeTag('DEBUG',
    source.replace(/@INCLUDE\[code:([^\n]+?)\]@/g, (match, codeKey) => {
      if (typeof code[codeKey] !== 'string') {
        throw new Error(`Missing code block: ${codeKey}`);
      }
      return code[codeKey];
    }));

  return {
    banner: `/*! ${pkg.title || pkg.name} v${pkg.version} (c) ${pkg.author.name} ${pkg.homepage} */\n`,
    source: packedSource
  };
}

export async function extractTestFunctions() {
  const source = await readFile(LEADER_LINE_SOURCE_PATH, 'utf8');
  const matches = Array.from(source.matchAll(RE_TEST_FUNC_EXPORT));
  const writtenFiles = [];

  for (const [, relativePath, content] of matches) {
    const filePath = path.resolve(SRC_DIR, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, content);
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}
