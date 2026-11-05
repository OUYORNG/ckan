const { chromium } = require('../../node_modules/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const output = path.join(root, 'frontend/test-results');
fs.mkdirSync(output, { recursive: true });
const env = Object.fromEntries(fs.readFileSync(path.join(root, 'ckan-docker/.env'), 'utf8').split('\n').filter(line => line && !line.startsWith('#')).map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')]; }));
const base = 'http://localhost:5100';
const suffix = Date.now().toString(36);
const orgName = 'resource-qa-' + suffix;
const datasetName = orgName + '-data';
const userNames = [];
let browser, context, page, organization, dataset, resource;
async function result(response) { const json = await response.json(); assert(json.success, JSON.stringify(json.error)); return json.result; }
async function session(ctx = context) { return result(await ctx.request.get(base + '/portal/api/session')); }
async function native(name, data) { const value = await session(); return result(await context.request.post(base + '/api/3/action/' + name, { data, headers: { 'X-CSRFToken': value.csrf_token } })); }
async function login(ctx, name, password) { const value = await session(ctx); await result(await ctx.request.post(base + '/portal/api/login', { data: { login: name, password }, headers: { 'X-CSRFToken': value.csrf_token } })); }
async function waitFor(read, matches, message) { for (let n = 0; n < 50; n++) { const value = await read(); if (matches(value)) return value; await new Promise(resolve => setTimeout(resolve, 500)); } throw new Error(message); }
(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await login(context, env.CKAN_SYSADMIN_NAME, env.CKAN_SYSADMIN_PASSWORD);
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 500) errors.push(response.status() + ' ' + response.url()); });
  await page.goto(base + '/dataset/moi-11a1-media-statistics/resource/d5cc83bc-96c7-43fe-8911-c90ee54c4953', { waitUntil: 'networkidle' });
  await page.getByRole('link', { name: 'Edit resource', exact: true }).click();
  await page.getByLabel('Resource name').waitFor();
  for (const name of ['Edit resource', 'DataStore', 'Upload log', 'Data dictionary', 'Views']) await page.getByRole('navigation', { name: 'Resource management' }).getByRole('link', { name, exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'resource-edit-desktop.png'), fullPage: true });
  console.log('Requested 11A1 resource shows edit form and all five management tabs.');

  organization = await native('organization_create', { name: orgName, title: 'Resource QA ' + suffix });
  dataset = await native('package_create', { name: datasetName, title: 'Resource management test', private: true, owner_org: organization.id });
  const source = JSON.stringify([{ year: 2023, value: 12.5 }, { year: 2024, value: 14.2 }]);
  const csrf = (await session()).csrf_token;
  resource = await result(await context.request.post(base + '/portal/api/action/resource_create', { headers: { 'X-CSRFToken': csrf }, multipart: { package_id: dataset.id, name: 'Original resource', description: 'Original description', format: 'JSON', migration_role: 'qa-provenance', source_sha256: crypto.createHash('sha256').update(source).digest('hex'), upload: { name: 'test.json', mimeType: 'application/json', buffer: Buffer.from(source) } } }));
  await native('datastore_create', { resource_id: resource.id, force: true, fields: [{ id: 'year', type: 'int' }, { id: 'value', type: 'numeric' }], primary_key: ['year'], records: [{ year: 2023, value: 12.5 }, { year: 2024, value: 14.2 }] });
  const originalTable = await native('datastore_search', { resource_id: resource.id, sort: 'year' });
  const editUrl = `${base}/dataset/${datasetName}/resource/${resource.id}/edit`;
  await page.goto(editUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Resource name').fill('Updated resource name');
  await page.getByLabel('Resource description').fill('Edited in the React resource manager.');
  await page.getByLabel('Resource format').fill('TSV');
  await page.getByRole('button', { name: 'Save resource', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Resource details saved.' }).waitFor();
  const updated = await native('resource_show', { id: resource.id });
  assert.equal(updated.name, 'Updated resource name'); assert.equal(updated.description, 'Edited in the React resource manager.'); assert.equal(updated.format, 'TSV');
  assert.equal(updated.url, resource.url); assert.equal(updated.migration_role, resource.migration_role); assert.equal(updated.source_sha256, resource.source_sha256);
  assert.equal(await (await context.request.get(updated.url)).text(), source);
  assert.deepEqual((await native('datastore_search', { resource_id: resource.id, sort: 'year' })).records, originalTable.records);
  console.log('Name/description/format edits persisted without changing the file, provenance, or table records.');

  await page.getByRole('navigation', { name: 'Resource management' }).getByRole('link', { name: 'Data dictionary', exact: true }).click();
  await page.getByLabel('Label for value').fill('Annual value / តម្លៃ');
  await page.getByLabel('Description for value').fill('Source values retained without changing stored records.');
  await page.getByLabel('Type override for value').selectOption('numeric');
  await page.getByRole('button', { name: 'Save dictionary', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Data dictionary saved.' }).waitFor();
  const info = await native('datastore_info', { id: resource.id });
  const valueField = info.fields.find(field => field.id === 'value');
  assert.equal(valueField.info.label, 'Annual value / តម្លៃ'); assert.equal(valueField.info.type_override, 'numeric');
  assert(info.fields.find(field => field.id === 'year').schema.is_index, 'Year index must survive dictionary edits.');
  await native('datastore_upsert', { resource_id: resource.id, force: true, method: 'update', dry_run: true, records: [{ year: 2023, value: 12.5 }] });
  assert.deepEqual((await native('datastore_search', { resource_id: resource.id, sort: 'year' })).records, originalTable.records);
  console.log('Dictionary labels, descriptions, and type override saved; records and primary key preserved.');

  const nav = page.getByRole('navigation', { name: 'Resource management' });
  await nav.getByRole('link', { name: 'Views', exact: true }).click();
  await page.getByLabel('View type').selectOption('datatables_view');
  await page.getByLabel('View title').fill('QA table');
  await page.getByLabel('View description').fill('Created from React');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.locator('.resource-view-list article').filter({ hasText: 'QA table' }).waitFor();
  await page.getByLabel('View title').fill('QA second table');
  await page.getByLabel('View type').selectOption('datatables_view');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  await page.getByRole('button', { name: 'Move QA table down', exact: true }).click();
  await waitFor(() => native('resource_view_list', { id: resource.id }), views => views.findIndex(view => view.title === 'QA second table') < views.findIndex(view => view.title === 'QA table'), 'View order did not change.');
  await page.getByRole('button', { name: 'Edit QA table', exact: true }).click();
  await page.getByLabel('View title').fill('QA updated table');
  await page.getByRole('button', { name: 'Save view', exact: true }).click();
  const viewCard = page.locator('.resource-view-list article').filter({ hasText: 'QA updated table' });
  await viewCard.getByRole('button', { name: 'Preview', exact: true }).click();
  await page.frameLocator('iframe[title="Preview: QA updated table"]').locator('table').first().waitFor();
  await page.getByRole('button', { name: 'Close preview', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete QA updated table', exact: true }).click();
  await waitFor(() => native('resource_view_list', { id: resource.id }), views => !views.some(view => view.title === 'QA updated table'), 'View deletion failed.');
  console.log('View creation, configuration, ordering, preview, and deletion passed.');

  await nav.getByRole('link', { name: 'DataStore', exact: true }).click();
  await page.getByLabel('DataStore upload file').setInputFiles({ name: 'replacement.csv', mimeType: 'text/csv', buffer: Buffer.from('year,value\n2025,21\n2026,22\n') });
  await page.getByRole('button', { name: 'Upload file and import', exact: true }).click();
  const status = await waitFor(() => context.request.get(base + '/portal/api/resource/' + resource.id + '/status').then(result), value => value.status === 'complete' || value.status === 'error', 'DataStore import did not complete.');
  assert.equal(status.status, 'complete', JSON.stringify(status.error));
  assert(!('job_key' in status) && !('job_url' in status), 'Upload service credentials must stay on the server.');
  assert.equal(status.row_count, 2);
  const records = await native('datastore_search', { resource_id: resource.id, sort: 'year' });
  assert.deepEqual(records.records.map(row => Number(row.year)), [2025, 2026]);
  await nav.getByRole('link', { name: 'Upload log', exact: true }).click();
  await page.locator('.upload-log-list li').first().waitFor();
  await page.screenshot({ path: path.join(output, 'resource-upload-log.png'), fullPage: true });
  console.log('File replacement, DataStore import, live status, and actual upload logs passed.');

  for (const role of ['member', 'editor', 'outside']) {
    const name = `res-${role}-${suffix}`; const password = crypto.randomBytes(18).toString('hex');
    await native('user_create', { name, email: name + '@example.test', password }); userNames.push(name);
    if (role !== 'outside') await native('organization_member_create', { id: organization.id, username: name, role });
    const user = await browser.newContext();
    try {
      await login(user, name, password); const value = await session(user);
      for (const ending of ['status', 'view-types']) assert.equal((await user.request.get(`${base}/portal/api/resource/${resource.id}/${ending}`)).status(), role === 'editor' ? 200 : 403);
      const patch = await user.request.post(base + '/portal/api/action/resource_patch', { data: { id: resource.id, description: 'Role check' }, headers: { 'X-CSRFToken': value.csrf_token } });
      assert.equal(patch.status(), role === 'editor' ? 200 : 403);
      const dictionary = await user.request.post(`${base}/portal/api/resource/${resource.id}/dictionary`, { data: { fields: [] }, headers: { 'X-CSRFToken': value.csrf_token } });
      assert.equal(dictionary.status(), role === 'editor' ? 200 : 403);
      const view = await user.request.post(base + '/portal/api/action/resource_view_create', { data: { resource_id: resource.id, title: 'Role view', view_type: 'datatables_view' }, headers: { 'X-CSRFToken': value.csrf_token } });
      assert.equal(view.status(), role === 'editor' ? 200 : 403);
    } finally { await user.close(); }
  }
  console.log('Resource metadata, dictionaries, views, and upload status enforce editor permissions.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(editUrl, { waitUntil: 'networkidle' });
  await page.getByLabel('Resource name').waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await page.screenshot({ path: path.join(output, 'resource-edit-mobile.png'), fullPage: true });
  assert.deepEqual(errors, [], 'No JavaScript or server errors expected.');
  console.log('Resource management mobile layout and browser checks passed.');
})().catch(async error => { console.error(error); if (page) await page.screenshot({ path: path.join(output, 'resource-management-failure.png'), fullPage: true }).catch(() => {}); process.exitCode = 1; }).finally(async () => {
  if (context) {
    try { if (dataset) await native('package_delete', { id: dataset.id }); if (organization) await native('organization_delete', { id: organization.id }); for (const name of userNames) await native('user_delete', { id: name }); console.log('Temporary resource QA records cleaned up.'); } catch (error) { console.error('Cleanup failed:', error.message); process.exitCode = 1; }
    await context.close();
  }
  if (browser) await browser.close();
});
