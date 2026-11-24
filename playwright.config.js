/* Browser tests. Uses an installed Chromium-based browser (Edge on Windows, Chrome elsewhere / in CI), so no
   browser download is needed. The site is served under /recallhsc/ exactly like GitHub Pages. */
const {defineConfig,devices}=require('@playwright/test');
const PORT=+process.env.PORT||5180;
const channel=process.env.PW_CHANNEL||(process.platform==='win32'?'msedge':'chrome');
module.exports=defineConfig({
  testDir:'tests',
  timeout:60000,
  expect:{timeout:8000},
  fullyParallel:false,
  workers:1,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[['list'],['html',{open:'never'}]]:'list',
  use:{baseURL:`http://localhost:${PORT}/recallhsc/`,channel,trace:'retain-on-failure',serviceWorkers:'allow'},
  webServer:{command:`node tools/serve.cjs ${PORT}`,url:`http://localhost:${PORT}/recallhsc/`,reuseExistingServer:!process.env.CI,timeout:20000},
  projects:[
    {name:'e2e',testDir:'tests/e2e',use:{...devices['Desktop Chrome'],channel}},
    {name:'a11y',testDir:'tests/a11y',use:{...devices['Desktop Chrome'],channel,bypassCSP:true}}, // lets the test inject axe-core; the site's CSP is otherwise untouched
    {name:'perf',testDir:'tests/performance',testMatch:/.*\.spec\.cjs/,use:{...devices['Desktop Chrome'],channel}},
  ],
});
