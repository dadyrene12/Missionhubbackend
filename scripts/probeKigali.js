const { chromium } = require('playwright-core');

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      channel: 'msedge',
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
    });
    const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
    page.setDefaultTimeout(30000);
    console.log('loading jobs page...');
    await page.goto('https://www.kigalijob.com/jobs', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);

    // Try to find links that look like job listings
    const links = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href') || '';
        const text = (a.innerText || '').replace(/\s+/g, ' ').trim();
        if (href.includes('job') || /job/i.test(text) || href.includes('/jobs')) {
          out.push({ href, text: text.slice(0, 120) });
        }
      });
      return out.slice(0, 40);
    });
    console.log('LINKS:');
    links.forEach(l => console.log(' -', JSON.stringify(l)));

    // Dump body classes / any card-like containers
    const containers = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('div').forEach(d => {
        const cls = d.className && typeof d.className === 'string' ? d.className : '';
        if (/card|job|list|post|item|grid/i.test(cls) && cls.length < 200) {
          const kids = d.children.length;
          if (kids >= 2) out.push({ cls: cls.slice(0, 160), kids });
        }
      });
      return out.slice(0, 40);
    });
    console.log('CONTAINERS:');
    containers.forEach(c => console.log(' -', JSON.stringify(c)));

    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
    console.log('BODY TEXT SAMPLE:');
    console.log(bodyText);
  } catch (e) {
    console.error('PROBE ERROR:', e.message);
  } finally {
    if (browser) await browser.close();
  }
  process.exit(0);
})();
