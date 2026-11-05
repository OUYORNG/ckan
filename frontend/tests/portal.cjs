const { chromium } = require('../../node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'frontend/test-results');
fs.mkdirSync(output, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(root, 'ckan-docker/.env'), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1).replace(/^"|"$/g, '')]; }));
const base = 'http://localhost:5100';
const suffix = Date.now().toString(36);
const org = 'portal-qa-' + suffix;
const dataset = org + '-dataset';
const accounts = ['member', 'editor', 'outside'].map(role => ({ name: `qa-${role}-${suffix}`, role, password: crypto.randomBytes(20).toString('hex') }));
const errors = [];
let administrator;
let browser;
let createdOrg = false;
let createdDataset = false;
const createdUsers = [];
async function json(response) { const body = await response.json(); assert(body.success, JSON.stringify(body.error)); return body.result; }
async function session(context) { return json(await context.request.get(base + '/portal/api/session')); }
async function write(context, name, data, expected = 200) { const value = await session(context); const response = await context.request.post(base + '/portal/api/action/' + name, { data, headers: { 'X-CSRFToken': value.csrf_token } }); assert.equal(response.status(), expected, name + ': ' + await response.text()); return expected === 200 ? json(response) : response; }
async function native(name, data) { const value = await session(administrator); return json(await administrator.request.post(base + '/api/3/action/' + name, { data, headers: { 'X-CSRFToken': value.csrf_token } })); }
async function login(context, name, password) { const value = await session(context); await json(await context.request.post(base + '/portal/api/login', { data: { login: name, password }, headers: { 'X-CSRFToken': value.csrf_token } })); }
(async () => {
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
  administrator = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  const page = await administrator.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Data that moves/ }).waitFor();
  assert.equal(await page.locator('iframe').count(), 0, 'React must render the page directly.');
  await page.screenshot({ path: path.join(output, 'overview-desktop.png'), fullPage: true });
  const blocked = await page.request.get(base + '/portal/api/action/package_show?id=moi-11a2-companies-2024');
  assert([403, 404].includes(blocked.status()), 'Private dataset must be denied to visitors.');
  await page.goto(base + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Username or email').fill(env.CKAN_SYSADMIN_NAME);
  await page.getByLabel('Password', { exact: true }).fill(env.CKAN_SYSADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/workspace');
  await page.getByRole('heading', { name: /Welcome back,/ }).waitFor();
  console.log('React login and private dataset protection passed.');

  await page.goto(base + '/organization/ministry-of-information', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Ministry of Information/ }).waitFor();
  await page.locator('.dataset-card').first().waitFor();
  await page.screenshot({ path: path.join(output, 'organization-desktop.png'), fullPage: true });
  const imported = JSON.parse(fs.readFileSync(path.join(root, 'migrations/11-upload/report.json'), 'utf8'));
  for (const item of imported.datasets) {
    await page.goto(base + new URL(item.table_url).pathname, { waitUntil: 'networkidle' });
    await page.locator('.data-table tbody tr').first().waitFor();
    assert((await page.locator('.table-summary').innerText()).includes(String(item.rows)), item.name + ' row count');
    const search = item.rows === 58 ? '2024' : item.name.includes('11a2') ? 'CTN' : 'Fresh News';
    await page.getByLabel('Search table records').fill(search);
    await page.getByLabel('Search table records').press('Enter');
    await page.locator('.table-summary').filter({ hasText: `${item.rows === 58 ? 19 : 1} matching records` }).waitFor();
    console.log('Imported table search passed:', item.name);
  }
  await page.goto(base + new URL(imported.datasets[1].table_url).pathname, { waitUntil: 'networkidle' });
  await page.locator('.data-table tbody tr').first().waitFor();
  await page.screenshot({ path: path.join(output, 'table-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Data dictionary', exact: true }).click();
  await page.getByRole('heading', { name: 'Understand every field' }).waitFor();
  await page.goto(base + '/account', { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'API tokens', exact: true }).waitFor();
  await page.locator('.token-list').waitFor();
  const invalidWrite = await page.request.post(base + '/portal/api/action/package_create', { data: { name: 'must-not-create' } });
  assert.equal(invalidWrite.status(), 400, 'Writes must require CSRF protection.');
  const method = await page.request.get(base + '/portal/api/action/package_create');
  assert.equal(method.status(), 405);
  console.log('Session, data dictionary, account, and CSRF checks passed.');

  await page.goto(base + '/organization/new', { waitUntil: 'networkidle' });
  await page.getByLabel('Organization title').fill('Portal QA ' + suffix);
  await page.getByLabel('URL identifier').fill(org);
  await page.getByLabel('Description', { exact: true }).fill('Temporary records for automated React portal verification.');
  await page.getByLabel('Logo URL', { exact: true }).fill('https://example.test/logo.png');
  await page.getByRole('button', { name: 'Add metadata', exact: true }).click();
  await page.getByLabel('Metadata key 1', { exact: true }).fill('department');
  await page.getByLabel('Metadata value 1', { exact: true }).fill('ព័ត៌មាន / Information');
  await page.getByRole('button', { name: 'Create organization', exact: true }).click();
  await page.waitForURL('**/organization/' + org);
  createdOrg = true;
  let organization = await native('organization_show', { id: org });
  assert.equal(organization.image_url, 'https://example.test/logo.png');
  assert.deepEqual(organization.extras.map(({ key, value }) => ({ key, value })), [{ key: 'department', value: 'ព័ត៌មាន / Information' }]);
  await page.goto(base + '/organization/edit/' + org, { waitUntil: 'networkidle' });
  await page.getByLabel('Upload logo').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6XGQAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.waitForURL('**/organization/' + org);
  organization = await native('organization_show', { id: org });
  assert(!organization.image_url.startsWith('http'));
  assert.equal((await page.request.get(organization.image_display_url)).status(), 200);
  assert.deepEqual(organization.extras.map(({ key, value }) => ({ key, value })), [{ key: 'department', value: 'ព័ត៌មាន / Information' }]);
  await page.goto(base + '/organization/edit/' + org, { waitUntil: 'networkidle' });
  await page.getByLabel('Remove current logo').check();
  await page.getByRole('button', { name: 'Remove metadata 1', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.waitForURL('**/organization/' + org);
  organization = await native('organization_show', { id: org });
  assert.equal(organization.image_url, '');
  assert.deepEqual(organization.extras, []);
  console.log('Organization logo URL, image upload/removal, and custom metadata round trips passed.');
  await page.goto(base + '/dataset/new', { waitUntil: 'networkidle' });
  await page.getByLabel('Dataset title').fill('Portal QA dataset ' + suffix);
  await page.getByLabel('URL identifier').fill(dataset);
  await page.getByLabel('Organization', { exact: true }).selectOption({ label: 'Portal QA ' + suffix });
  await page.getByLabel('Description', { exact: true }).fill('Original QA description.');
  for (const [label, value] of Object.entries({ 'Source URL': 'https://example.gov.kh/data', Version: '2024.1', Author: 'នាយកដ្ឋានព័ត៌មាន', 'Author email': 'author@example.test', Maintainer: 'Information data team', 'Maintainer email': 'maintainer@example.test' })) await page.getByLabel(label, { exact: true }).fill(value);
  for (const [index, key, value] of [[1, 'source_sha256', 'preserve-source-reference'], [2, 'reporting_period', '2024']]) {
    await page.getByRole('button', { name: 'Add metadata', exact: true }).click();
    await page.getByLabel('Metadata key ' + index, { exact: true }).fill(key);
    await page.getByLabel('Metadata value ' + index, { exact: true }).fill(value);
  }
  await page.getByRole('button', { name: 'Create dataset', exact: true }).click();
  await page.waitForURL('**/dataset/' + dataset);
  createdDataset = true;
  await page.getByRole('link', { name: /Edit dataset/ }).click();
  await page.getByLabel('Description', { exact: true }).fill('Updated through the React dataset editor.');
  assert.equal(await page.getByLabel('Author', { exact: true }).inputValue(), 'នាយកដ្ឋានព័ត៌មាន');
  await page.getByLabel('Version', { exact: true }).fill('2024.2');
  const removableMetadataIndex = (await page.getByLabel('Metadata key 1', { exact: true }).inputValue()) === 'source_sha256' ? 2 : 1;
  await page.getByRole('button', { name: 'Remove metadata ' + removableMetadataIndex, exact: true }).click();
  await page.getByRole('button', { name: 'Add metadata', exact: true }).click();
  await page.getByLabel('Metadata key 2', { exact: true }).fill('source_sha256');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Custom metadata keys must be nonempty and unique.', { exact: true }).waitFor();
  await page.getByLabel('Metadata key 2', { exact: true }).fill('coverage');
  await page.getByLabel('Metadata value 2', { exact: true }).fill('Cambodia');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.waitForURL('**/dataset/' + dataset);
  await page.getByText('Updated through the React dataset editor.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Add resource', exact: true }).click();
  await page.getByLabel('Choose resource file').setInputFiles({ name: 'portal-qa.csv', mimeType: 'text/csv', buffer: Buffer.from('year,campus,enrolled\n2024,Test campus,12\n2025,Test campus,14\n') });
  await page.getByLabel('Resource name').fill('Portal QA CSV');
  await page.getByRole('button', { name: 'Add resource', exact: true }).click();
  await page.waitForURL(/\/resource\/[a-f0-9-]+$/);
  const resourceId = page.url().split('/').pop();
  for (let attempt = 0; attempt < 40; attempt++) {
    const resource = await json(await page.request.get(base + '/portal/api/action/resource_show?id=' + resourceId));
    if (resource.datastore_active) break;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.data-table tbody tr').first().waitFor();
  assert((await page.locator('.table-summary').innerText()).includes('2 records'));
  const csv = await page.request.get(base + '/datastore/dump/' + resourceId + '?format=csv');
  assert.equal(csv.status(), 200);
  assert((await csv.text()).includes('Test campus'));
  const beforeMetadataEdit = await native('package_show', { id: dataset });
  await page.goto(base + '/dataset/edit/' + dataset, { waitUntil: 'networkidle' });
  await page.getByLabel('Maintainer', { exact: true }).fill('Updated maintainer');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.waitForURL('**/dataset/' + dataset);
  const afterMetadataEdit = await native('package_show', { id: dataset });
  for (const [key, value] of Object.entries({ url: 'https://example.gov.kh/data', version: '2024.2', author: 'នាយកដ្ឋានព័ត៌មាន', author_email: 'author@example.test', maintainer: 'Updated maintainer', maintainer_email: 'maintainer@example.test' })) assert.equal(afterMetadataEdit[key], value);
  assert.deepEqual(afterMetadataEdit.extras, [{ key: 'coverage', value: 'Cambodia' }, { key: 'source_sha256', value: 'preserve-source-reference' }]);
  assert.deepEqual(afterMetadataEdit.resources, beforeMetadataEdit.resources);
  assert.equal(afterMetadataEdit.owner_org, beforeMetadataEdit.owner_org);
  assert.equal(afterMetadataEdit.private, true);
  await page.goto(base + '/dataset/edit/' + dataset, { waitUntil: 'networkidle' });
  await page.getByLabel('Metadata key 1', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'dataset-metadata-desktop.png'), fullPage: true });
  console.log('Dataset contacts, source/version, custom metadata validation/removal, and resource preservation passed.');
  console.log('React organization/dataset creation, editing, file upload, and CSV export passed.');

  for (const account of accounts) {
    await write(administrator, 'user_create', { name: account.name, email: `${account.name}@example.test`, password: account.password, fullname: `QA ${account.role}` });
    createdUsers.push(account.name);
    if (account.role !== 'outside') await write(administrator, 'organization_member_create', { id: org, username: account.name, role: account.role });
  }
  await page.goto(base + '/organization/members/' + org, { waitUntil: 'networkidle' });
  await page.getByText(accounts[0].name, { exact: false }).waitFor();
  await page.getByRole('heading', { name: 'Organization members', exact: true }).waitFor();
  for (const account of accounts) {
    const context = await browser.newContext();
    try {
      await login(context, account.name, account.password);
      const resource = await context.request.get(base + '/portal/api/action/package_show?id=' + dataset);
      if (account.role === 'outside') assert([403, 404].includes(resource.status()));
      else assert.equal(resource.status(), 200);
      await write(context, 'package_patch', { id: dataset, notes: 'Editor permission verified.' }, account.role === 'editor' ? 200 : 403);
      await write(context, 'organization_patch', { id: org, extras: [{ key: 'unauthorized', value: 'no' }] }, 403);
      const members = await context.request.get(base + '/portal/api/organizations/' + org + '/members');
      assert.equal(members.status(), 403);
      const userList = await context.request.get(base + '/portal/api/users');
      assert.equal(userList.status(), 403);
    } finally { await context.close(); }
  }
  console.log('Member, editor, unrelated-user, and administrator permissions passed.');
  const value = await session(administrator);
  const token = await write(administrator, 'api_token_create', { user: value.user.name, name: 'portal-qa-token-' + suffix });
  assert(token.token);
  const tokenList = await json(await page.request.get(base + '/portal/api/action/api_token_list?user=' + value.user.name));
  const temporary = tokenList.find(item => item.name === 'portal-qa-token-' + suffix);
  assert(temporary);
  await write(administrator, 'api_token_revoke', { jti: temporary.id });
  console.log('API token creation and revocation passed.');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Data catalog' }).click();
  await page.waitForURL('**/dataset');
  await page.locator('.dataset-card').first().waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile catalog must not overflow horizontally.');
  await page.screenshot({ path: path.join(output, 'catalog-mobile.png'), fullPage: true });
  await page.goto(base + new URL(imported.datasets[1].table_url).pathname, { waitUntil: 'networkidle' });
  await page.locator('.data-table tbody tr').first().waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile table must scroll inside its container.');
  await page.screenshot({ path: path.join(output, 'table-mobile.png'), fullPage: true });
  await page.goto(base + '/dataset/edit/' + dataset, { waitUntil: 'networkidle' });
  await page.getByLabel('Metadata key 1', { exact: true }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'Mobile metadata editor must not overflow.');
  await page.screenshot({ path: path.join(output, 'dataset-metadata-mobile.png'), fullPage: true });
  assert.deepEqual(errors, [], 'Browser/server errors');
  console.log('Desktop/mobile navigation, layout, and browser error checks passed.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (administrator) {
    try {
      if (createdDataset) await native('package_delete', { id: dataset });
      if (createdOrg) await native('organization_delete', { id: org });
      for (const name of createdUsers) await native('user_delete', { id: name });
      console.log('Temporary QA records cleaned up.');
    } catch (error) { console.error('QA cleanup failed:', error.message); process.exitCode = 1; }
    await administrator.close();
  }
  if (browser) await browser.close();
});
