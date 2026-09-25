// Isolated UI test: API requests are intercepted, so no live contract can be changed.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const base = process.env.TERMINATION_TEST_URL || 'http://127.0.0.1:5175';
  const output = path.resolve(__dirname, '../../.runtime/termination-browser/screenshots');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    for (const role of ['admin', 'student']) {
      const context = await browser.newContext({ viewport: role === 'admin' ? { width: 1440, height: 1000 } : { width: 390, height: 844 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const id = '00000000-0000-0000-0000-000000000001';
      let request = { id: 'case-1', anchorAgreementId: id, classroomId: 1, wholeClass: role === 'admin',
        reason: 'Gia su gap su co va khong the tiep tuc day.', requestedBy: 'tutor@example.test',
        status: role === 'admin' ? 'RECOMMENDED' : 'REQUESTED', createdAt: '2026-09-21T12:00:00Z', auditJson: '[]' };
      let items = [];
      let fail = false;
      const commands = [];
      await page.route('**/api/**', async route => {
        const req = route.request();
        const url = new URL(req.url());
        let body = {};
        if (url.pathname === '/api/contracts/agreements') body = { content: [{ id, classroomId: 1, status: 'ACTIVE',
          studentName: 'Hoc vien co ho ten dai de kiem tra hien thi', className: 'Lop toan nang cao', onchainFunded: true }], totalElements: 1 };
        if (url.pathname === '/api/contracts/terminations') {
          if (req.method() === 'POST') {
            const payload = req.postDataJSON(); commands.push(payload);
            request = { ...request, reason: payload.reason, wholeClass: payload.wholeClass };
            body = { request, items };
          } else body = [{ request, items }];
        }
        if (url.pathname.endsWith('/actions')) {
          const payload = req.postDataJSON(); commands.push(payload);
          request = { ...request, status: 'APPROVED' };
          items = [{ agreementId: id, studentName: 'Hoc vien kiem thu', status: 'BLOCKCHAIN_PENDING', refundedUnits: null,
            tokenDecimals: 6, chainId: 11155111, transactionHash: '0x' + 'a'.repeat(64), lastError: null }];
          body = { request, items };
        }
        await route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json',
          body: JSON.stringify(fail ? { message: 'Dich vu tam thoi gian doan' } : body), headers: { 'access-control-allow-origin': base, 'access-control-allow-credentials': 'true' } });
      });
      await page.route('**/__termination_smoke__', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main id="root" style="max-width:1100px;margin:auto;padding:16px"></main><script type="module">
        import RefreshRuntime from '/@react-refresh'; RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type; window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const { createRoot } = await import('/node_modules/.vite/deps/react-dom_client.js');
        await import('/src/index.css');
        const { TerminationPanel } = await import('/src/components/contract/TerminationPanel.tsx');
        createRoot(document.getElementById('root')).render(React.createElement(TerminationPanel, { activeRole: '${role}' }));
      </script></body></html>` }));
      await page.goto(base + '/__termination_smoke__');
      await page.getByRole('heading', { name: 'Hồ sơ chấm dứt hợp đồng' }).waitFor();
      if (role === 'admin') {
        await page.getByRole('button', { name: 'Phê duyệt chấm dứt' }).click();
        await page.getByLabel('Nội dung xác minh / giải trình').fill('Da doi chieu minh chung va xac nhan su co.');
        await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
        await page.getByText('Chưa xác nhận', { exact: true }).waitFor();
        assert.equal(commands[0].action, 'APPROVE');
      } else {
        assert.equal(await page.getByRole('button', { name: 'Gửi yêu cầu' }).count(), 0);
        await page.getByRole('button', { name: 'Giải trình' }).click();
        await page.getByLabel('Nội dung xác minh / giải trình').fill('Bo sung thong tin su co cua hoc vien.');
        await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
        assert.equal(commands[0].action, 'RESPOND');
        assert.equal(await page.getByRole('button', { name: 'Phê duyệt chấm dứt' }).count(), 0);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.screenshot({ path: path.join(output, role + '.png'), fullPage: true });
      fail = true;
      await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert.deepEqual(errors, []);
      console.log(role + ': actions, permissions, pending refund, error state and viewport passed');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
