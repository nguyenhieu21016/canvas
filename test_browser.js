import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
  await page.goto('http://localhost:5173/#/assignments', { waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log(e));
  setTimeout(() => browser.close(), 5000);
})();
