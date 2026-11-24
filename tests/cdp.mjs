// Tiny Chrome DevTools driver: real headless browsers, real network, no extra packages.
import { spawn } from 'node:child_process';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function launch(port, profileDir) {
  const proc = spawn('chromium', ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`, '--window-size=412,915', 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await sleep(300); }
  }
  return { port, proc, close: () => proc.kill('SIGKILL') };
}

export async function openPage(browser, url) {
  const t = await (await fetch(`http://127.0.0.1:${browser.port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.type + ': ' + m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Page.javascriptDialogOpening') { logs.push('DIALOG: ' + m.params.message); send('Page.handleJavaScriptDialog', { accept: true }); }
  };
  const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Page.enable');
  const page = {
    logs, send,
    async eval(expr) {
      const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
      if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error');
      return r.result?.result?.value;
    },
    async waitFor(expr, ms = 20000, label = expr) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try { if (await page.eval(expr)) return true; } catch {}
        await sleep(300);
      }
      throw new Error('timeout waiting for: ' + label);
    },
    async goto(u) { await send('Page.navigate', { url: u }); await sleep(800); },
    async shot(path) {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      (await import('node:fs')).writeFileSync(path, Buffer.from(r.result.data, 'base64'));
    },
    close() { ws.close(); },
  };
  return page;
}

export { sleep };
