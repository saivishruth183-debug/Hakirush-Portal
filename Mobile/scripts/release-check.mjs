#!/usr/bin/env node
// Release gate for the Hakirush mobile app. Fails (exit 1) when the app is not shippable.
//   node scripts/release-check.mjs                 → internal-test mode (provisional ids = warning)
//   node scripts/release-check.mjs --mode=store    → store mode (provisional ids / non-https API = failure)
// A passing TypeScript check is NOT a substitute for this gate.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = (process.argv.find((a) => a.startsWith('--mode=')) ?? '--mode=internal').split('=')[1];
const failures = [];
const warnings = [];

const exists = (rel) => fs.existsSync(path.join(root, rel));
const walk = (dir) => {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? walk(rel) : [rel];
  });
};

// 1. Route tree must exist and contain every required destination.
const routeFiles = walk('src/app').filter((f) => /\.(tsx|ts)$/.test(f));
if (routeFiles.length === 0) failures.push('src/app route tree is empty');

const REQUIRED_ROUTES = [
  'src/app/_layout.tsx',
  'src/app/index.tsx',
  'src/app/(auth)/login.tsx',
  'src/app/access-denied.tsx',
  'src/app/+not-found.tsx',
  // employee
  'src/app/employee/_layout.tsx',
  'src/app/employee/(tabs)/index.tsx',
  'src/app/employee/(tabs)/attendance.tsx',
  'src/app/employee/(tabs)/team.tsx',
  'src/app/employee/(tabs)/leave.tsx',
  'src/app/employee/(tabs)/more.tsx',
  'src/app/employee/change-password.tsx',
  // admin
  'src/app/admin/_layout.tsx',
  'src/app/admin/(tabs)/index.tsx',
  'src/app/admin/(tabs)/people.tsx',
  'src/app/admin/(tabs)/attendance.tsx',
  'src/app/admin/(tabs)/requests.tsx',
  'src/app/admin/(tabs)/more.tsx',
  'src/app/admin/change-password.tsx',
  // client
  'src/app/client/_layout.tsx',
  'src/app/client/(tabs)/index.tsx',
  'src/app/client/(tabs)/relationship.tsx',
  'src/app/client/(tabs)/updates.tsx',
  'src/app/client/(tabs)/account.tsx',
  'src/app/client/change-password.tsx',
];
for (const r of REQUIRED_ROUTES) if (!exists(r)) failures.push(`missing route ${r}`);

// Secondary destinations: at least one route file must exist under each prefix.
const REQUIRED_PREFIXES = [
  'src/app/employee/payslips', 'src/app/employee/profile', 'src/app/employee/leave-apply',
  'src/app/employee/holidays', 'src/app/employee/notices', 'src/app/employee/notifications',
  'src/app/admin/employees', 'src/app/admin/departments', 'src/app/admin/clients',
  'src/app/admin/sponsors', 'src/app/admin/stalls', 'src/app/admin/leaves',
  'src/app/admin/holidays', 'src/app/admin/announcements', 'src/app/admin/attendance-report',
  'src/app/admin/notifications',
  'src/app/client/gallery', 'src/app/client/update',
];
for (const p of REQUIRED_PREFIXES) {
  if (!routeFiles.some((f) => f === `${p}.tsx` || f.startsWith(`${p}/`) || f.startsWith(`${p}.`))) {
    failures.push(`missing destination ${p}`);
  }
}

// 2. No production route or feature may render the placeholder.
const sources = [...walk('src/app'), ...walk('src/features')].filter((f) => /\.(tsx|ts)$/.test(f));
for (const f of sources) {
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  if (/PlaceholderScreen/.test(text)) failures.push(`placeholder still used in ${f}`);
  if (/coming soon|in a later step|will be implemented/i.test(text)) failures.push(`unfinished copy in ${f}`);
}

// 3. Required automated tests must exist.
const tests = walk('src').filter((f) => /\.test\.(ts|tsx)$/.test(f));
const REQUIRED_TESTS = [
  [/services\/api\/__tests__\//, 'API client tests'],
  [/services\/session\/__tests__\//, 'session tests'],
  [/features\/employee\/.*team.*\.test\.tsx?$/i, 'employee Team screen test'],
  [/features\/client\/.*\.test\.tsx?$/, 'client feature tests'],
  [/features\/admin\/.*\.test\.tsx?$/, 'admin feature tests'],
];
for (const [re, label] of REQUIRED_TESTS) if (!tests.some((t) => re.test(t))) failures.push(`missing ${label}`);
if (!exists('jest.setup.ts')) failures.push('jest.setup.ts missing');

// 4. Identifiers and API URL.
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const ids = [app.android?.package, app.ios?.bundleIdentifier];
if (ids.some((id) => !id || /provisional|example/i.test(id))) {
  (mode === 'store' ? failures : warnings).push(`application identifiers are provisional (${ids.join(', ')})`);
}
const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
if (mode === 'store') {
  if (!apiUrl) failures.push('EXPO_PUBLIC_API_URL is not set for the store build');
  else if (!/^https:\/\//i.test(apiUrl)) failures.push('EXPO_PUBLIC_API_URL must be https for the store build');
  if (process.env.EXPO_PUBLIC_ALLOW_INSECURE_LOCAL_API === 'true') failures.push('EXPO_PUBLIC_ALLOW_INSECURE_LOCAL_API must not be set for the store build');
} else if (!apiUrl) {
  warnings.push('EXPO_PUBLIC_API_URL not set in this shell (set it for the build)');
}

for (const w of warnings) console.log(`WARN  ${w}`);
for (const f of failures) console.log(`FAIL  ${f}`);
console.log(`\nrelease-check (${mode}): ${failures.length ? 'FAILED' : 'PASSED'} — ${routeFiles.length} route files, ${tests.length} test files, ${failures.length} failures, ${warnings.length} warnings`);
process.exit(failures.length ? 1 : 0);
