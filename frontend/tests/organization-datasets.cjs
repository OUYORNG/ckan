const { chromium } = require('../../node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const env = Object.fromEntries(fs.readFileSync(path.join(root, 'ckan-docker/.env'), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')]; }));
const base = 'http://localhost:5100';
const output = path.join(root, 'frontend/test-results');
fs.mkdirSync(output, { recursive: true });
const suffix = Date.now().toString(36);
const org = 'bulk-qa-' + suffix;
const otherOrg = org + '-other';
const accounts = ['admin', 'editor', 'member', 'outside'].map(role => ({ role, name: `bulk-${role}-${suffix}`, password: crypto.randomBytes(20).toString('hex') }));
const createdUsers = [], createdDatasets = [], createdOrgs = [], errors = [];
let browser, sysadmin, administrator;
async function json(response) { const body = await response.json(); assert(body.success, JSON.stringify(body.error)); return body.result; }
async function session(context) { return json(await context.request.get(base + '/portal/api/session')); }
async function login(context, login, password) { const value = await session(context); return json(await context.request.post(base + '/portal/api/login', { data: { login, password }, headers: { 'X-CSRFToken': value.csrf_token } })); }
async function native(name, data) { const value = await session(sysadmin); return json(await sysadmin.request.post(base + '/api/3/action/' + name, { data, headers: { 'X-CSRFToken': value.csrf_token } })); }
async function bulk(context, operation, datasets, expected = 200) { const value = await session(context); const response = await context.request.post(base + `/portal/api/organizations/${org}/datasets/bulk`, { data: { operation, datasets }, headers: { 'X-CSRFToken': value.csrf_token } }); assert.equal(response.status(), expected, await response.text()); return expected === 200 ? json(response) : response; }
(async () => {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  sysadmin = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await login(sysadmin, env.CKAN_SYSADMIN_NAME, env.CKAN_SYSADMIN_PASSWORD);
  const sourcePage = await sysadmin.newPage();
  await sourcePage.goto(base + '/organization/ministry-of-information', { waitUntil: 'networkidle' });
  assert.equal(await sourcePage.getByRole('link', { name: 'Manage datasets', exact: true }).count(), 0);
  assert.equal(await sourcePage.getByRole('checkbox').count(), 0);
  await sourcePage.getByRole('button', { name: 'Card view', exact: true }).click();
  await sourcePage.locator('.dataset-card').first().waitFor();
  await sourcePage.getByRole('button', { name: 'Edit datasets', exact: true }).click();
  await sourcePage.getByLabel('Select all datasets on this page').waitFor();
  await sourcePage.locator('.dataset-rows tbody tr').first().waitFor();
  assert.equal(await sourcePage.locator('.dataset-rows tbody tr').count(), 3);
  await sourcePage.screenshot({ path: path.join(output, 'organization-datasets-desktop.png'), fullPage: true });
  console.log('Organization management entry point and original three datasets verified without changing them.');
  for (const name of [org, otherOrg]) { await native('organization_create', { name, title: name }); createdOrgs.push(name); }
  const organization = await native('organization_show', { id: org });
  const other = await native('organization_show', { id: otherOrg });
  for (let i = 0; i < 21; i++) {
    const dataset = await native('package_create', { name: `${org}-${i}`, title: `Dataset ${String(i + 1).padStart(2, '0')}`, owner_org: organization.id, private: true, notes: i === 0 ? null : 'Temporary organization dataset management verification.', extras: [{ key: 'source_sha256', value: 'preserve-provenance' }] });
    createdDatasets.push(dataset.id);
  }
  const unrelated = await native('package_create', { name: otherOrg + '-dataset', title: 'Unrelated dataset', owner_org: other.id, private: true });
  createdDatasets.push(unrelated.id);
  const resource = await native('resource_create', { package_id: createdDatasets[0], name: 'Preserved source', format: 'CSV', url: 'https://example.test/original.csv' });
  await native('datastore_create', { resource_id: resource.id, force: true, fields: [{ id: 'year', type: 'int' }, { id: 'value', type: 'numeric' }], records: [{ year: 2024, value: 15 }] });
  const original = await native('package_show', { id: createdDatasets[0] });
  for (const account of accounts) {
    await native('user_create', { name: account.name, email: account.name + '@example.test', password: account.password }); createdUsers.push(account.name);
    if (account.role !== 'outside') await native('organization_member_create', { id: org, username: account.name, role: account.role });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
    await login(context, account.name, account.password);
    const permission = await json(await context.request.get(base + `/portal/api/organizations/${org}/dataset-permissions`));
    assert.equal(permission.manage, account.role === 'admin');
    if (account.role === 'admin') administrator = context;
    else { await bulk(context, 'public', [createdDatasets[0]], 403); const reader = await context.newPage(); await reader.goto(base + '/organization/' + org + '?edit=true', { waitUntil: 'networkidle' }); assert.equal(await reader.getByRole('button', { name: 'Edit datasets', exact: true }).count(), 0); assert.equal(await reader.getByRole('checkbox').count(), 0); await context.close(); }
  }
  assert.equal((await administrator.request.post(base + `/portal/api/organizations/${org}/datasets/bulk`, { data: { operation: 'public', datasets: [createdDatasets[0]] } })).status(), 400);
  await bulk(administrator, 'unsupported', [createdDatasets[0]], 400);
  await bulk(administrator, 'public', [], 400);
  await bulk(administrator, 'public', [createdDatasets[0], createdDatasets[0]], 400);
  await bulk(administrator, 'public', [createdDatasets[0], unrelated.id], 403);
  assert.equal((await native('package_show', { id: createdDatasets[0] })).private, true);
  console.log('Admin/member/editor/outside permissions, CSRF, and complete-selection validation passed.');
  const page = await administrator.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(response.status() + ' ' + response.url()); });
  const url = base + '/organization/' + org;
  await page.goto(url, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('button', { name: 'Row view', exact: true }).getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('checkbox').count(), 0);
  await page.getByRole('button', { name: 'Card view', exact: true }).click();
  await page.locator('.dataset-card').first().waitFor();
  await page.getByRole('button', { name: 'Edit datasets', exact: true }).click();
  await page.getByLabel('Select all datasets on this page').waitFor();
  await page.getByLabel('Sort datasets').selectOption('title_string asc');
  await page.waitForFunction(() => document.querySelector('.dataset-row-title h3')?.textContent === 'Dataset 01');
  assert.equal(await page.locator('.dataset-rows tbody tr').count(), 20);
  assert.deepEqual(await page.locator('.dataset-row-title h3').allTextContents(), Array.from({ length: 20 }, (_, i) => 'Dataset ' + String(i + 1).padStart(2, '0')));
  await page.getByLabel('Select Dataset 01', { exact: true }).check();
  await page.getByRole('button', { name: 'Card view', exact: true }).click();
  await page.locator('.dataset-card').first().waitFor();
  assert.equal(await page.getByRole('checkbox').count(), 0);
  assert.equal(await page.getByRole('button', { name: /Make private|Make public|Delete datasets/ }).count(), 0);
  assert.equal(await page.getByRole('region', { name: 'Confirm bulk action' }).count(), 0);
  await page.screenshot({ path: path.join(output, 'organization-datasets-cards.png'), fullPage: true });
  await page.getByRole('button', { name: 'Edit datasets', exact: true }).click();
  await page.getByText('0 selected', { exact: true }).waitFor();
  await page.getByLabel('Select all datasets on this page').check();
  await page.getByText('20 selected', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Make public', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel action', exact: true }).click();
  assert.equal((await native('package_show', { id: createdDatasets[0] })).private, true);
  await page.getByRole('button', { name: 'Make public', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm make public', exact: true }).click();
  await page.getByText('20 datasets made public.', { exact: true }).waitFor();
  await page.locator('.dataset-rows tbody tr').first().waitFor();
  assert.equal((await native('package_show', { id: createdDatasets[20] })).private, true, 'Selection must affect only this page.');
  const anonymous = await browser.newContext();
  assert.equal((await anonymous.request.get(base + '/api/3/action/package_show?id=' + createdDatasets[0])).status(), 200);
  await page.getByLabel('Select all datasets on this page').check();
  await page.getByRole('button', { name: 'Make private', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm make private', exact: true }).click();
  await page.getByText('20 datasets made private.', { exact: true }).waitFor();
  await page.locator('.dataset-rows tbody tr').first().waitFor();
  assert.equal((await anonymous.request.get(base + '/api/3/action/package_show?id=' + createdDatasets[0])).status(), 403);
  await anonymous.close();
  const after = await native('package_show', { id: createdDatasets[0] });
  assert.deepEqual(after.resources, original.resources);
  assert.deepEqual(after.extras, original.extras);
  assert.deepEqual((await native('datastore_search', { resource_id: resource.id })).records.map(({ year, value }) => ({ year, value })), [{ year: 2024, value: 15 }]);
  console.log('Row-only selection, card browsing, cancellation, page-scoped visibility changes, and source/table preservation passed.');
  await page.goto(url + '?edit=true&sort=title_string%20asc&page=2', { waitUntil: 'networkidle' });
  await page.getByLabel('Select Dataset 21', { exact: true }).check();
  await page.getByRole('button', { name: 'Delete datasets', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete datasets', exact: true }).click();
  await page.waitForURL(value => value.pathname === '/organization/' + org && value.searchParams.get('page') === '1');
  await page.waitForFunction(() => document.querySelectorAll('.dataset-rows tbody tr').length === 20);
  assert.equal(await page.locator('.dataset-rows tbody tr').count(), 20);
  await page.getByLabel('Sort datasets').selectOption('title_string desc');
  await page.waitForFunction(() => document.querySelector('.dataset-row-title h3')?.textContent === 'Dataset 20');
  assert.equal(await page.locator('.dataset-row-title h3').first().textContent(), 'Dataset 20');
  await page.getByLabel('Search catalog').fill('"Dataset 03"');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.locator('.dataset-row-title h3').filter({ hasText: 'Dataset 03' }).waitFor();
  await page.waitForFunction(() => document.querySelectorAll('.dataset-rows tbody tr').length === 1);
  assert.equal(await page.locator('.dataset-rows tbody tr').count(), 1);
  await page.getByLabel('Select Dataset 03', { exact: true }).check();
  await page.getByRole('button', { name: 'Delete datasets', exact: true }).click();
  await page.getByRole('region', { name: 'Confirm bulk action' }).getByText('Dataset 03', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Confirm delete datasets', exact: true }).click();
  await page.getByText('1 dataset deleted.', { exact: true }).waitFor();
  await page.getByRole('heading', { name: 'No datasets found', exact: true }).waitFor();
  assert.equal((await native('package_show', { id: createdDatasets[2] })).state, 'deleted');
  assert.equal((await native('package_show', { id: createdDatasets[1] })).state, 'active');
  console.log('Search, sorting, explicit delete confirmation, and unselected dataset preservation passed.');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Add dataset', exact: true }).click();
  assert.equal(await page.getByLabel('Organization', { exact: true }).inputValue(), organization.id);
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Edit datasets', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Select all datasets on this page').waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(output, 'organization-datasets-mobile.png'), fullPage: true, animations: 'disabled' });
  await page.getByRole('button', { name: 'Card view', exact: true }).click();
  await page.locator('.dataset-card').first().waitFor();
  assert.equal(await page.getByRole('checkbox').count(), 0);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.getByRole('button', { name: 'Edit datasets', exact: true }).click();
  await page.getByLabel('Select all datasets on this page').waitFor();
  await page.getByRole('button', { name: 'Done editing', exact: true }).click();
  await page.getByLabel('Select all datasets on this page').waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('checkbox').count(), 0);
  await page.goto(base + '/organization/bulk_process/' + org, { waitUntil: 'networkidle' });
  await page.waitForURL(value => value.pathname === '/organization/' + org && value.searchParams.get('edit') === 'true');
  await page.getByLabel('Select all datasets on this page').waitFor();
  assert.deepEqual(errors, []);
  console.log('New dataset organization preselection, mobile row/card layouts, and browser checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (sysadmin) {
    try { for (const id of createdDatasets) await native('package_delete', { id }); for (const id of createdOrgs) await native('organization_delete', { id }); for (const id of createdUsers) await native('user_delete', { id }); console.log('Temporary organization-management QA records cleaned up.'); }
    catch (error) { console.error('QA cleanup failed:', error.message); process.exitCode = 1; }
  }
  if (browser) await browser.close();
});
