import { chromium } from '@playwright/test';
import http from 'node:http';
import { mkdir, writeFile, rename, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const project = fileURLToPath(new URL('../', import.meta.url));
const defaultDirectory = path.join(project, '.orbital-playtest');
const atomicJSON = async (filename, value) => {
  await writeFile(filename + '.tmp', JSON.stringify(value, null, 2));
  await rename(filename + '.tmp', filename);
};
export async function startPlaytest(options = {}) {
  const port = options.port ?? Number(process.env.ORBITAL_PLAYTEST_PORT || 9333);
  const directory = options.directory || defaultDirectory;
  const startedAt = Date.now(), sessionId = `${new Date(startedAt).toISOString().replace(/[:.]/g, '-')}-${process.pid}`;
  const sessionDir = path.join(directory, 'sessions', sessionId);
  const gameURL = pathToFileURL(path.join(project, 'dist/index.html')).href + '?playtest=1';
  await mkdir(sessionDir, { recursive: true });
  let context, page, captureSession, timer, busy, closed = false, lastSequence = 0, lastRecorderStart = 0, slot = 0;
  let latest = null, frames = [], events = [], lastError = null;
  const bookmarks = new Set();
  const status = () => ({ app: 'ORBITAL playtest', project, pid: process.pid, port, sessionId, sessionDir, gameURL,
    startedAt, closed, ready: !!page && !page.isClosed(), recording: latest?.recording ?? false,
    lastCaptureAt: latest?.capturedAt || null, latest, lastError });
  const saveStatus = () => atomicJSON(path.join(directory, 'session.json'), status());
  const preserve = async mark => {
    const key = `${lastRecorderStart}-${mark.seq}`;
    if (bookmarks.has(key)) return;
    bookmarks.add(key);
    const folder = path.join(sessionDir, 'marks', key);
    await mkdir(folder, { recursive: true });
    const copies = [];
    for (const frame of frames) {
      const screenshotPath = path.join(folder, path.basename(frame.screenshotPath));
      const snapshotPath = path.join(folder, path.basename(frame.snapshotPath));
      await Promise.all([copyFile(frame.screenshotPath, screenshotPath), copyFile(frame.snapshotPath, snapshotPath)]);
      copies.push({ ...frame, screenshotPath, snapshotPath });
    }
    await atomicJSON(path.join(folder, 'history.json'), { mark, frames: copies, events });
  };
  const capture = () => {
    if (busy) return busy;
    busy = (async () => {
      if (!page || page.isClosed() || closed) return { recording: false, reason: 'Playtest window is closed.' };
      // Never inspect pages outside the explicitly opened game tab and URL.
      if (page.url() !== gameURL) { latest = { ...latest, recording: false, reason: 'The playtest tab navigated away from ORBITAL.' }; await saveStatus(); return latest; }
      const bundle = await page.evaluate(({ lastSequence, lastRecorderStart }) => {
        const recorder = window.orbitalPlaytest;
        if (!recorder) return null;
        const snapshot = recorder.inspect();
        return { snapshot, events: recorder.eventsSince(lastRecorderStart === snapshot.startedAt ? lastSequence : 0) };
      }, { lastSequence, lastRecorderStart });
      if (!bundle) return { recording: false, reason: 'Game recorder is not ready.' };
      lastRecorderStart = bundle.snapshot.startedAt; lastSequence = bundle.snapshot.lastSequence;
      events.push(...bundle.events);
      const now = Date.now(); events = events.filter(e => e.at >= now - 120000).slice(-2400);
      if (!bundle.snapshot.recording) {
        latest = { ...latest, recording: false, reason: 'Recording paused by the player. Displayed artifacts are historical.' };
        for (const mark of bundle.events.filter(e => e.type === 'bookmark')) await preserve(mark);
        await atomicJSON(path.join(sessionDir, 'history.json'), { sessionId, frames, events });
        await saveStatus(); return latest;
      }
      const screenshotPath = path.join(sessionDir, `frame-${String(slot).padStart(3, '0')}.jpg`);
      const snapshotPath = path.join(sessionDir, `frame-${String(slot).padStart(3, '0')}.json`);
      // Capture the existing surface directly. Playwright's page.screenshot path
      // closes native select popups in headed Chrome on Windows. Do not inject
      // screenshot styles, clip/resize the viewport, or change focus here.
      const { data } = await captureSession.send('Page.captureScreenshot', {
        format: 'jpeg', quality: 70, fromSurface: true, captureBeyondViewport: false,
      });
      const screenshot = Buffer.from(data, 'base64');
      if (!await page.evaluate(() => window.orbitalPlaytest?.isRecording())) {
        latest = { ...latest, recording: false, reason: 'Recording paused by the player during capture.' };
        for (const mark of bundle.events.filter(e => e.type === 'bookmark')) await preserve(mark);
        await saveStatus(); return latest;
      }
      await writeFile(screenshotPath + '.tmp', screenshot); await rename(screenshotPath + '.tmp', screenshotPath);
      await atomicJSON(snapshotPath, bundle.snapshot);
      latest = { recording: true, capturedAt: bundle.snapshot.capturedAt, screenshotAt: Date.now(),
        scenario: bundle.snapshot.controls.scenario, simTime: bundle.snapshot.controls.time,
        selectedId: bundle.snapshot.controls.selectedId, screenshotPath, snapshotPath };
      frames = frames.filter(f => f.screenshotPath !== screenshotPath && f.capturedAt >= now - 120000);
      frames.push(latest); slot = (slot + 1) % 120;
      for (const mark of bundle.events.filter(e => e.type === 'bookmark')) await preserve(mark);
      await atomicJSON(path.join(sessionDir, 'latest.json'), latest);
      await atomicJSON(path.join(sessionDir, 'history.json'), { sessionId, frames, events });
      await saveStatus(); return latest;
    })().finally(() => { busy = null; });
    return busy;
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
    if (req.headers.origin || ![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host)) { res.writeHead(403).end('{}'); return; }
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (req.method === 'GET' && url.pathname === '/status') res.end(JSON.stringify(status()));
      else if (req.method === 'GET' && url.pathname === '/snapshot') res.end(JSON.stringify(await capture()));
      else if (req.method === 'GET' && url.pathname === '/recent') {
        const seconds = Math.max(1, Math.min(120, Number(url.searchParams.get('seconds') || 20)));
        res.end(JSON.stringify({ frames: frames.filter(f => f.capturedAt >= Date.now() - seconds * 1000), events: events.filter(e => e.at >= Date.now() - seconds * 1000) }));
      } else if (req.method === 'POST' && url.pathname === '/focus') {
        if (page && !page.isClosed() && page.url() === gameURL) await page.bringToFront();
        res.end(JSON.stringify(status()));
      } else res.writeHead(404).end('{}');
    } catch (error) { res.writeHead(500).end(JSON.stringify({ error: error.message })); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const close = async () => {
    if (closed) return; closed = true; clearInterval(timer);
    if (busy) await busy.catch(() => {});
    await context?.close().catch(() => {});
    await new Promise(resolve => server.close(resolve));
    await saveStatus();
  };
  try {
    context = await chromium.launchPersistentContext(path.join(directory, 'browser-profile'), {
      executablePath: process.env.ORBITAL_BROWSER || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
      headless: options.headless ?? false, viewport: options.headless ? { width: 1440, height: 960 } : null,
      args: ['--window-size=1440,960', '--no-first-run', '--no-default-browser-check'],
    });
    page = context.pages()[0] || await context.newPage();
    captureSession = await context.newCDPSession(page);
    await page.goto(gameURL); await page.waitForFunction(() => !!window.orbitalPlaytest);
    await capture();
    timer = setInterval(() => capture().catch(error => { lastError = error.message; }), options.interval ?? 1000);
    context.on('close', () => close());
    console.log(`ORBITAL shared playtest ready. Inspection: http://127.0.0.1:${port} · history: ${sessionDir}`);
    return { page, context, capture, close, status, sessionDir };
  } catch (error) { await close(); throw error; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.ORBITAL_PLAYTEST_PORT || 9333);
  let existing;
  try { existing = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(600) }).then(r => r.json()); } catch {}
  if (existing?.app === 'ORBITAL playtest' && existing.project === project && existing.ready) {
    await fetch(`http://127.0.0.1:${port}/focus`, { method: 'POST' });
    console.log('The existing ORBITAL shared playtest window is ready.');
  } else {
    const session = await startPlaytest();
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => session.close());
  }
}
