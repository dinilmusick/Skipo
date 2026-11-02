import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolvePreviewInspectionConfig(manifest) {
  const config = manifest?.browserInspection;
  if (!config || config.enabled === false) throw new Error('Browser inspection is disabled or missing in the Skipo manifest.');
  const routes = config.routes?.length ? config.routes : ['/'];
  const viewports = config.viewports?.length ? config.viewports : [{ width: 1440, height: 900 }];
  for (const route of routes) {
    if (typeof route !== 'string' || !route.startsWith('/')) throw new Error(`Inspection route must begin with "/": ${route}`);
  }
  for (const viewport of viewports) {
    if (!(viewport.width > 0 && viewport.height > 0)) throw new Error('Inspection viewport dimensions must be positive.');
  }
  return {
    routes, viewports, checks: config.checks ?? [], captureDom: config.captureDom !== false,
    timeoutMs: config.timeoutMs ?? 30000, waitUntil: config.waitUntil ?? 'domcontentloaded',
    maxDomCharacters: config.maxDomCharacters ?? 200000,
  };
}

export function buildPreviewTargets(baseUrl, config) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Preview URL must use HTTP or HTTPS.');
  for (const route of config.routes) {
    if (typeof route !== 'string' || !route.startsWith('/')) throw new Error(`Inspection route must begin with "/": ${route}`);
  }
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return config.viewports.flatMap(viewport => config.routes.map(route => ({
    url: new URL(route.replace(/^\/+/, ''), base).toString(), viewport,
  })));
}

function messageOf(value) {
  return value instanceof Error ? value.message : String(value);
}

function safeName(value) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'root';
}

async function loadPlaywright() {
  const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
  const playwright = modulePath
    ? await import(pathToFileURL(resolve(modulePath)).href)
    : await import('playwright');
  return playwright.chromium ? playwright : playwright.default;
}

export async function runPreviewInspection({ baseUrl, manifest, outputDirectory = 'artifacts/browser-inspection', playwright }) {
  const config = resolvePreviewInspectionConfig(manifest);
  const targets = buildPreviewTargets(baseUrl, config);
  const startedAt = Date.now();
  const results = [];
  const browserApi = playwright ?? await loadPlaywright();
  const browser = await browserApi.chromium.launch({ headless: true });

  try {
    for (const target of targets) {
      const targetStartedAt = Date.now();
      const page = await browser.newPage({ viewport: target.viewport });
      const logs = [];
      const errors = [];
      const routeName = safeName(new URL(target.url).pathname);
      const screenshot = join(outputDirectory, 'screenshots', `${routeName}-${target.viewport.width}x${target.viewport.height}.png`);
      page.on('console', entry => {
        const item = { type: entry.type(), message: entry.text(), location: entry.location() };
        logs.push(item);
        if (item.type === 'error') errors.push({ kind: 'console', ...item });
      });
      page.on('pageerror', error => errors.push({ kind: 'pageerror', message: messageOf(error) }));
      page.on('requestfailed', request => errors.push({ kind: 'requestfailed', url: request.url(), method: request.method(), message: request.failure()?.errorText ?? 'Request failed' }));
      page.on('response', response => {
        if (response.status() >= 400) errors.push({ kind: 'http', url: response.url(), status: response.status(), message: `HTTP ${response.status()}` });
      });
      page.on('crash', () => errors.push({ kind: 'crash', message: 'Browser page crashed.' }));

      let status;
      let title;
      let domSnapshot;
      const checks = [];
      try {
        const response = await page.goto(target.url, { waitUntil: config.waitUntil, timeout: config.timeoutMs });
        status = response?.status();
        title = await page.title();
        if (status && status >= 400) errors.push({ kind: 'navigation', status, message: `Navigation returned HTTP ${status}` });
        for (const check of config.checks) {
          try {
            const locator = page.locator(check.selector).first();
            const count = await locator.count();
            if (!count) throw new Error('Selector matched no elements.');
            if (check.visible !== undefined && await locator.isVisible() !== check.visible) throw new Error(`Expected visible=${check.visible}.`);
            if (check.text !== undefined && !(await locator.innerText()).includes(check.text)) throw new Error(`Expected text containing: ${check.text}`);
            checks.push({ selector: check.selector, passed: true });
          } catch (error) {
            const result = { selector: check.selector, passed: false, details: messageOf(error) };
            checks.push(result);
            errors.push({ kind: 'assertion', ...result });
          }
        }
        if (config.captureDom) domSnapshot = (await page.content()).slice(0, config.maxDomCharacters);
        await mkdir(dirname(screenshot), { recursive: true });
        await page.screenshot({ path: screenshot, fullPage: true });
      } catch (error) {
        errors.push({ kind: 'navigation', message: messageOf(error), url: target.url });
      } finally {
        await page.close();
      }
      results.push({
        url: target.url, viewport: target.viewport, status, title,
        durationMs: Date.now() - targetStartedAt, ok: errors.length === 0,
        logs, errors, checks, screenshot, domSnapshot,
      });
    }
  } finally {
    await browser.close();
  }

  const report = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), baseUrl,
    durationMs: Date.now() - startedAt, ok: results.every(result => result.ok),
    summary: {
      targets: results.length, passed: results.filter(result => result.ok).length,
      failed: results.filter(result => !result.ok).length,
      consoleLogs: results.reduce((count, result) => count + result.logs.length, 0),
      errors: results.reduce((count, result) => count + result.errors.length, 0),
    },
    results,
  };
  await mkdir(outputDirectory, { recursive: true });
  const reportPath = join(outputDirectory, 'report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  return { ...report, reportPath };
}

async function main() {
  const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, values) => {
    if (value.startsWith('--')) pairs.push([value.slice(2), values[index + 1]]);
    return pairs;
  }, []));
  const baseUrl = args.url || process.env.SKIPO_PREVIEW_URL;
  const manifestPath = args.manifest || process.env.SKIPO_INSPECTION_MANIFEST;
  if (!baseUrl || !manifestPath) throw new Error('Provide --url and --manifest (or SKIPO_PREVIEW_URL and SKIPO_INSPECTION_MANIFEST).');
  const manifest = JSON.parse(await readFile(resolve(manifestPath), 'utf8'));
  const result = await runPreviewInspection({ baseUrl, manifest, outputDirectory: args.output || 'artifacts/browser-inspection' });
  process.stdout.write(JSON.stringify({ ok: result.ok, summary: result.summary, reportPath: result.reportPath }, null, 2) + '\n');
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { process.stderr.write(messageOf(error) + '\n'); process.exitCode = 1; });
}
