#!/usr/bin/env node
'use strict';
/** Standalone, read-only TypeScript/React architecture analyser. No Skipo CLI imports. */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const DEFAULT_POLICY = path.resolve(__dirname, '../architecture/semantic/owners.json');
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'coverage', '.turbo', '.pnpm', 'vendor']);
const ROOT_DIRS = new Set(['src', 'app', 'pages', 'components', 'apps', 'packages']);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sorted = (items) => [...items].sort(compare);
const unix = (p) => p.split(path.sep).join('/');
const matchPrefix = (specifier, prefix) => prefix.endsWith('/') || prefix.endsWith(':')
  ? specifier.startsWith(prefix) : specifier === prefix || specifier.startsWith(prefix + '/');
const rel = (root, file) => unix(path.relative(root, file));
const inside = (root, file) => file === root || file.startsWith(root + path.sep);

function typescript(root) {
  // The analyzer may live outside the application (e.g. an installed CLI).
  // Load the compiler from the analyzed project's installed dependency first;
  // never resolve an unrelated parent package or execute a global fallback.
  const engine = path.resolve(__dirname, '..');
  for (const base of [root, engine]) {
    const candidate = path.join(base, 'node_modules', 'typescript');
    try {
      const physical = fs.realpathSync(candidate);
      if (!inside(base, physical) || !fs.statSync(physical).isDirectory()) continue;
      return require(candidate);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'MODULE_NOT_FOUND') {
        throw error;
      }
    }
  }
  // Preserve read-only CLI diagnostics for legacy/uninstalled projects.
  // An installed application compiler always wins over the global fallback.
  try {
    const globalRoot = cp.execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    return require(require.resolve('typescript', { paths: [globalRoot] }));
  } catch (_) {
    throw new Error('TypeScript compiler API unavailable; install the existing TypeScript devDependency');
  }
}
function validatePolicy(value) {
  const stringList = (x) => Array.isArray(x) && x.every(v => typeof v === 'string' && v.length > 0) && new Set(x).size === x.length;
  if (!value || value.version !== 1 || !stringList(value.publicBackendBarrels) ||
      !stringList(value.providerPackages) || !stringList(value.privateSegments) ||
      !stringList(value.browserForbidden) || !stringList(value.browserAllowed) ||
      !value.capabilities || typeof value.capabilities !== 'object' || Array.isArray(value.capabilities)) {
    throw new Error('Invalid semantic policy schema/version');
  }
  for (const [name, cap] of Object.entries(value.capabilities)) {
    if (!name || !cap || typeof cap.replacement !== 'string' || !cap.replacement.trim() ||
        !['canonical', 'rawSdks', 'signals', 'declarations'].every(key => stringList(cap[key]))) {
      throw new Error('Invalid capability policy: ' + name);
    }
  }
  for (const entry of value.browserAllowed) {
    if (!value.browserForbidden.some(b => matchPrefix(entry, b))) continue;
    // A narrow public entrypoint may override a broader denied package, but not identical rules.
    if (value.browserForbidden.includes(entry)) throw new Error('Conflicting browser import policy: ' + entry);
  }
  for (const [a, cap] of Object.entries(value.capabilities)) for (const sdk of cap.rawSdks) {
    for (const [b, other] of Object.entries(value.capabilities)) {
      if (a !== b && other.rawSdks.includes(sdk)) throw new Error('Conflicting SDK ownership: ' + sdk);
    }
  }
  return value;
}
function blocked(message) {
  return { schemaVersion: 1, status: 'blocked', scannedFiles: 0, dependencies: [], findings: [{ ruleId: 'SEM000', severity: 'error', certainty: 'blocked', file: null, line: null, column: null, message, evidence: [], suggestedReplacement: null }], summary: { violations: 0, ambiguous: 0, blocked: 1 } };
}
function scanFiles(root, includeTests) {
  const out = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => compare(a.name,b.name))) {
      if (ent.isSymbolicLink()) continue;
      const location = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (SKIP_DIRS.has(ent.name) || (!includeTests && ['test', 'tests', '__tests__', 'fixtures'].includes(ent.name))) continue;
        walk(location);
      } else if (SOURCE_EXTENSIONS.has(path.extname(ent.name)) && !ent.name.endsWith('.d.ts') &&
                 (includeTests || !/\.(?:test|spec)\.[^.]+$/.test(ent.name))) out.push(location);
    }
  }
  for (const dir of sorted(ROOT_DIRS)) if (fs.existsSync(path.join(root, dir))) walk(path.join(root, dir));
  return sorted(new Set(out));
}
function plane(root, file) {
  const parts = rel(root, file).split('/');
  if (parts[0] === 'src' && ['frontend', 'backend', 'libraries'].includes(parts[1])) return parts[1];
  const index = parts.findIndex(p => p === 'frontend' || p === 'backend' || p === 'libraries');
  if (index >= 0) return parts[index];
  if (parts.includes('server') || parts.includes('api')) return 'backend';
  if (parts.includes('client') || parts.includes('ui') || parts.includes('components') || parts.includes('pages') || parts.includes('app')) return 'frontend';
  return 'unknown';
}
function packageOwner(root, file) {
  let dir = path.dirname(file);
  while (inside(root, dir)) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  return root;
}
function projectOptions(ts, root, file, cache) {
  let dir = path.dirname(file), config;
  while (inside(root, dir)) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(candidate)) { config = candidate; break; }
    if (dir === root) break;
    dir = path.dirname(dir);
  }
  if (!config) return { allowJs: true, moduleResolution: ts.ModuleResolutionKind.NodeNext, module: ts.ModuleKind.NodeNext };
  if (cache.has(config)) return cache.get(config);
  const raw = ts.readConfigFile(config, ts.sys.readFile);
  if (raw.error) throw new Error('Invalid TypeScript config: ' + rel(root, config));
  const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, path.dirname(config), undefined, config);
  if (parsed.errors.length) throw new Error('Invalid TypeScript config: ' + rel(root, config));
  cache.set(config, parsed.options);
  return parsed.options;
}
function localSource(root, resolved) {
  return inside(root, resolved) && !rel(root, resolved).split('/').some(segment =>
    segment === 'node_modules' || segment === '.pnpm');
}
function resolveLocal(ts, root, file, specifier, options) {
  const resolved = ts.resolveModuleName(specifier, file, options, ts.sys).resolvedModule;
  if (resolved && localSource(root, path.resolve(resolved.resolvedFileName)))
    return path.resolve(resolved.resolvedFileName);
  // Paths aliases and NodeNext .js -> .ts are handled by the compiler above; this
  // fallback covers a missing tsconfig and extensionless imports without guessing.
  if (!specifier.startsWith('.')) return null;
  const target = path.resolve(path.dirname(file), specifier);
  const candidates = [target, ...['.ts','.tsx','.js','.jsx','.mts','.cts'].map(ext => target + ext),
    ...['.ts','.tsx','.js','.jsx'].map(ext => path.join(target, 'index' + ext))];
  if (/\.jsx?$/.test(target)) candidates.push(target.replace(/\.jsx?$/, '.ts'), target.replace(/\.jsx?$/, '.tsx'));
  return candidates.find(p => localSource(root,p) && fs.existsSync(p) && fs.statSync(p).isFile()) || null;
}
function analyzeProject(rootInput, options = {}) {
  const root = path.resolve(rootInput || '.');
  let policy, ts;
  try {
    if (!fs.statSync(root).isDirectory()) throw new Error('Target must be a directory');
    policy = validatePolicy(JSON.parse(fs.readFileSync(options.policyPath || DEFAULT_POLICY, 'utf8')));
    ts = typescript(root);
  } catch (error) { return blocked(error.message); }
  const files = scanFiles(root, !!options.includeTests);
  const configCache = new Map();
  const sourceMap = new Map();
  const edges = [];
  const findings = [];
  const emit = (ruleId, severity, certainty, file, node, source, message, evidence, replacement = null) => {
    const pos = source && node ? source.getLineAndCharacterOfPosition(node.getStart(source)) : null;
    const finding = { ruleId, severity, certainty, file: file ? rel(root,file) : null,
      line: pos ? pos.line + 1 : null, column: pos ? pos.character + 1 : null,
      message, evidence, suggestedReplacement: replacement };
    findings.push(finding);
  };
  try {
    for (const file of files) {
      const scriptKind = file.endsWith('x') ? ts.ScriptKind.TSX : undefined;
      const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, scriptKind);
      sourceMap.set(file, source);
      const importSpecs = [];
      function walk(node) {
        if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
          importSpecs.push({ specifier: node.moduleSpecifier.text, node: node.moduleSpecifier, kind: ts.isExportDeclaration(node) ? 're-export' : 'import' });
        } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) &&
                   node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
          importSpecs.push({ specifier: node.moduleReference.expression.text, node: node.moduleReference.expression, kind: 'require' });
        } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                   (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
          const kind = node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic-import' : 'require';
          const arg = node.arguments[0];
          if (arg && (ts.isStringLiteralLike(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
            importSpecs.push({ specifier: arg.text, node: arg, kind });
          } else if (kind === 'dynamic-import') {
            emit('SEM107', 'warning', 'ambiguous', file, node, source, 'Dynamic import cannot be resolved statically',
              [{ kind: 'expression', value: node.getText(source).slice(0, 160) }]);
          }
        }
        ts.forEachChild(node, walk);
      }
      walk(source);
      const config = projectOptions(ts, root, file, configCache);
      for (const imp of importSpecs) {
        const target = resolveLocal(ts, root, file, imp.specifier, config);
        edges.push({ file, target, specifier: imp.specifier, kind: imp.kind, node: imp.node });
      }
    }
  } catch (error) { return blocked('Unable to parse or resolve source: ' + error.message); }
  const graph = new Map();
  for (const edge of edges) {
    if (!graph.has(edge.file)) graph.set(edge.file, []);
    graph.get(edge.file).push(edge);
    const origin = plane(root, edge.file);
    const destination = edge.target ? plane(root,edge.target) : 'unknown';
    const source = sourceMap.get(edge.file);
    if (edge.specifier.startsWith('.') && edge.target && packageOwner(root,edge.file) !== packageOwner(root,edge.target)) {
      emit('SEM103','error','violation',edge.file,edge.node,source,'Cross-package relative import',
        [{kind:'import',value:edge.specifier},{kind:'target',value:rel(root,edge.target)}],
        'Import from the target package public entrypoint');
    }
    const provider = policy.providerPackages.find(p => matchPrefix(edge.specifier,p));
    if (provider) {
      const suffix = edge.specifier.slice(provider.length).split('/').filter(Boolean);
      if (suffix.some(s => policy.privateSegments.includes(s) || s.startsWith('_'))) {
        emit('SEM104','error','violation',edge.file,edge.node,source,'Provider private implementation import',
          [{kind:'import',value:edge.specifier},{kind:'provider',value:provider}],
          'Import from the canonical package public exports');
      }
    }
    if (['frontend','libraries'].includes(origin)) {
      const forbidden = policy.browserForbidden.some(p => matchPrefix(edge.specifier,p));
      const allowed = policy.browserAllowed.some(p => matchPrefix(edge.specifier,p));
      if (forbidden && !allowed) emit('SEM102','error','violation',edge.file,edge.node,source,
        'Browser/shared module imports server-only implementation', [{kind:'import',value:edge.specifier}],
        'Use a browser-safe facade or canonical client entrypoint');
    }
    if (edge.target && origin !== 'unknown' && destination !== 'unknown') {
      const publicBarrel = origin === 'frontend' && destination === 'backend' &&
        policy.publicBackendBarrels.includes(rel(root,edge.target));
      const allowed = origin === destination || (origin === 'frontend' && destination === 'libraries') ||
        (origin === 'backend' && destination === 'libraries') || publicBarrel;
      if (!allowed) emit('SEM101','error','violation',edge.file,edge.node,source,
        `Forbidden dependency direction ${origin} -> ${destination}`,
        [{kind:'import',value:edge.specifier},{kind:'target',value:rel(root,edge.target)}],
        'Use a shared contract or the public backend facade');
    }
    if (edge.target === null && edge.specifier.startsWith('.')) {
      emit('SEM108','warning','ambiguous',edge.file,edge.node,source,
        'Relative import target not found; dependency direction unverified', [{kind:'import',value:edge.specifier}]);
    }
  }
  // Indirect imports are material when a frontend/shared entrypoint loads a server
  // module through a re-export or aliased barrel, even though its own import looks safe.
  for (const first of edges) {
    if (!first.target || !['frontend','libraries'].includes(plane(root,first.file)) ||
        plane(root,first.target) === 'backend') continue;
    const queue = [{ file: first.target, chain: [first.specifier] }];
    const seen = new Set([first.file]);
    while (queue.length) {
      const step = queue.shift();
      if (seen.has(step.file)) continue;
      seen.add(step.file);
      for (const nested of graph.get(step.file) || []) {
        if (nested.target && plane(root,nested.target) === 'backend') {
          emit('SEM109','error','violation',first.file,first.node,sourceMap.get(first.file),
            'Indirect import reaches backend implementation',
            [{kind:'chain',value:[...step.chain,nested.specifier].join(' -> ')},
              {kind:'target',value:rel(root,nested.target)}], 'Use the public backend facade');
        } else if (nested.target && !seen.has(nested.target) && step.chain.length < 12) {
          queue.push({file:nested.target,chain:[...step.chain,nested.specifier]});
        }
        if (policy.browserForbidden.some(p => matchPrefix(nested.specifier,p)) &&
            !policy.browserAllowed.some(p => matchPrefix(nested.specifier,p))) {
          emit('SEM109','error','violation',first.file,first.node,sourceMap.get(first.file),
            'Indirect import reaches server-only provider',
            [{kind:'chain',value:[...step.chain,nested.specifier].join(' -> ')}],
            'Use a browser-safe canonical client or shared contract');
        }
      }
    }
  }
  // AST identifiers and declaration signatures, not filenames or regex text, are
  // used for semantic duplication evidence. Canonical delegation is an extension.
  for (const file of files) {
    const source = sourceMap.get(file);
    const identifiers = new Set(), declarations = new Set();
    function visit(node) {
      if (ts.isIdentifier(node)) identifiers.add(node.text);
      if ((ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.name) declarations.add(node.name.text);
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) declarations.add(node.name.text);
      ts.forEachChild(node,visit);
    }
    visit(source);
    const imports = (graph.get(file)||[]).map(e=>e.specifier);
    for (const [capability, def] of Object.entries(policy.capabilities)) {
      const sdk = imports.filter(s => def.rawSdks.some(p => matchPrefix(s,p)));
      const canonical = imports.some(s => def.canonical.some(p => matchPrefix(s,p)));
      const evidence = [...def.signals.filter(s=>identifiers.has(s)), ...def.declarations.filter(s=>declarations.has(s))];
      const isCandidate = evidence.length >= 2 || def.declarations.some(s=>declarations.has(s));
      if (!sdk.length && (!isCandidate || canonical)) continue;
      // The provider may legitimately own its SDK; a source package named Kloks/Floks
      // should not be labeled a duplicate solely for using its own implementation.
      const currentPackage = (()=> { try { return JSON.parse(fs.readFileSync(path.join(packageOwner(root,file),'package.json'),'utf8')).name; } catch (_) { return null; } })();
      if (def.canonical.includes(currentPackage)) continue;
      const certain = sdk.length > 0 && (isCandidate || ['auth','storage'].some(s=>rel(root,file).split('/').includes(s)));
      if (!certain && !isCandidate) continue;
      const node = source.statements.find(st => ts.isClassDeclaration(st) || ts.isFunctionDeclaration(st) || ts.isVariableStatement(st)) || source.statements[0];
      emit(certain ? 'SEM105' : 'SEM106',certain?'error':'warning',certain?'violation':'ambiguous',
        file,node,source,certain ? `Possible noncanonical ${capability} implementation with direct provider SDK` :
          `Suspected ${capability} replacement; static evidence is inconclusive`,
        [...sdk.map(value=>({kind:'raw-sdk',value})),...evidence.map(value=>({kind:'identifier',value}))],def.replacement);
    }
  }
  // Remove duplicate paths to the same violation while preserving concise evidence.
  const seen = new Set();
  const unique = findings.filter(f => {
    const key = JSON.stringify([f.file,f.line,f.column,f.ruleId,f.message,f.evidence]);
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a,b)=>compare(a.file||'',b.file||'') || (a.line||0)-(b.line||0) || (a.column||0)-(b.column||0) || compare(a.ruleId,b.ruleId) || compare(a.message,b.message));
  const dependencies = edges.map(e=>({file:rel(root,e.file),target:e.target?rel(root,e.target):null,
    specifier:e.specifier,kind:e.kind,line:sourceMap.get(e.file).getLineAndCharacterOfPosition(e.node.getStart(sourceMap.get(e.file))).line+1}))
    .sort((a,b)=>compare(a.file,b.file) || a.line-b.line || compare(a.specifier,b.specifier) || compare(a.kind,b.kind));
  const summary = { violations:unique.filter(f=>f.certainty==='violation').length, ambiguous:unique.filter(f=>f.certainty==='ambiguous').length, blocked:0 };
  return {schemaVersion:1,status:summary.violations?'violations':summary.ambiguous?'ambiguous':'compliant',scannedFiles:files.length,dependencies,findings:unique,summary};
}
function cli(argv) {
  let root = '.', policyPath, includeTests = false;
  for (let i=0;i<argv.length;i++) {
    if (argv[i]==='--root' && argv[i+1]) root=argv[++i];
    else if (argv[i]==='--policy' && argv[i+1]) policyPath=argv[++i];
    else if (argv[i]==='--include-tests') includeTests=true;
    else if (argv[i]==='--json') {} // default JSON output
    else if (argv[i]==='--help') { process.stdout.write('Usage: node scripts/skipo_semantic_analyzer.cjs --root DIR [--policy FILE] [--include-tests] [--json]\n'); return 0; }
    else { process.stderr.write('Unexpected option: '+argv[i]+'\n'); return 2; }
  }
  const report=analyzeProject(root,{policyPath,includeTests});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  return report.status==='blocked'?2:report.status==='violations'?1:0;
}
if (require.main === module) process.exitCode=cli(process.argv.slice(2));
module.exports = { analyzeProject, validatePolicy, cli };
