import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const warnings = [];

let manifest;
try {
  manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
} catch (e) {
  console.error(`✖ manifest.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

const requiredKeys = ['manifest_version', 'name', 'version', 'background', 'content_scripts'];
for (const key of requiredKeys) {
  if (!(key in manifest)) errors.push(`Missing required key: "${key}"`);
}

if (manifest.manifest_version !== 3) {
  errors.push(`manifest_version must be 3 (got ${manifest.manifest_version})`);
}

if (!/^\d+(\.\d+){0,3}$/.test(String(manifest.version ?? ''))) {
  errors.push(`version "${manifest.version}" is not in x.y.z format`);
}

const sw = manifest.background?.service_worker;
if (!sw) errors.push('background.service_worker is required');
else if (!existsSync(sw)) errors.push(`background.service_worker file not found: ${sw}`);

const csList = manifest.content_scripts ?? [];
if (csList.length === 0) warnings.push('No content_scripts defined');
for (const [i, cs] of csList.entries()) {
  if (!Array.isArray(cs.matches) || cs.matches.length === 0) {
    errors.push(`content_scripts[${i}].matches must be a non-empty array`);
  }
  for (const m of cs.matches ?? []) {
    if (typeof m !== 'string' || !m.includes('://')) {
      warnings.push(`content_scripts[${i}].matches pattern may be invalid: "${m}"`);
    }
  }
  for (const f of cs.js ?? []) {
    if (!existsSync(f)) errors.push(`content_scripts[${i}] references missing file: ${f}`);
  }
}

if (manifest.permissions !== undefined && !Array.isArray(manifest.permissions)) {
  errors.push('permissions must be an array');
}

if (warnings.length) {
  console.warn('⚠ Warnings:');
  warnings.forEach((w) => console.warn(`  - ${w}`));
}

if (errors.length) {
  console.error('✖ Errors:');
  errors.forEach((e) => console.error(`  - ${e}`));
  process.exit(1);
}

console.log('✔ manifest.json is valid — MV3 structure OK, all referenced files exist.');