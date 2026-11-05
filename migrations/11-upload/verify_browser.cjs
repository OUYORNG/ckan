const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'report.json'), 'utf8'));
const env = Object.fromEntries(fs.readFileSync(path.join(root, 'ckan-docker/.env'), 'utf8')
  .split('\n').filter(line => line && !line.startsWith('#')).map(line => {
    const index = line.indexOf('=');
    return [line.slice(0, index), line.slice(index + 1)];
  }));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => {
      if (response.url().startsWith('http://localhost:5100') && response.status() >= 400)
        errors.push(`${response.status()} ${response.url()}`);
    });
    await page.goto('http://localhost:5100/user/login', { waitUntil: 'networkidle' });
    await page.locator('[name=login]').fill(env.CKAN_SYSADMIN_NAME);
    await page.locator('[name=password]').fill(env.CKAN_SYSADMIN_PASSWORD);
    await Promise.all([
      page.waitForURL('**/dashboard/**'),
      page.getByRole('button', { name: 'Login', exact: true }).click(),
    ]);
    await page.goto(report.organization_url, { waitUntil: 'networkidle' });
    for (const dataset of report.datasets)
      await page.locator(`.dataset-heading a[href="/dataset/${dataset.name}"]`).waitFor();
    await page.screenshot({ path: path.join(__dirname, 'organization.png'), fullPage: true });
    for (const dataset of report.datasets) {
      await page.goto(dataset.table_url, { waitUntil: 'networkidle' });
      const frame = page.frameLocator('iframe');
      await frame.locator('table.dataTable tbody tr').first().waitFor();
      const body = await frame.locator('body').innerText();
      if (!body.includes(`of ${dataset.rows} entries`))
        throw new Error(`Unexpected table count for ${dataset.name}: ${body.slice(-1000)}`);
      await page.screenshot({ path: path.join(__dirname, dataset.name + '.png'), fullPage: true });
      console.log('Verified browser table:', dataset.name, dataset.rows, 'records');
      const search = dataset.rows === 58 ? '2024' : dataset.name.includes('11a2') ? 'CTN' : 'Fresh News';
      const matches = dataset.rows === 58 ? 19 : 1;
      await frame.locator('input[type="search"]').first().fill(search);
      await frame.locator('input[type="search"]').first().press('Enter');
      await frame.locator('.dt-info,.dataTables_info').filter({ hasText: `of ${matches} entries` }).waitFor({timeout:10000}).catch(async error => { console.log('Filtered frame:', await frame.locator('body').innerText()); throw error; });
      console.log('Verified table search:', search, matches, 'matching records');
      await frame.locator('input[type="search"]').first().fill('');
      await frame.locator('.dt-info,.dataTables_info').filter({ hasText: `of ${dataset.rows} entries` }).waitFor();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    console.log('Admin organization page, three table previews, and local HTTP/JS checks passed.');
    report.browser_verified = true;
    fs.writeFileSync(path.join(__dirname, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
