import { test, expect } from '@playwright/test';

// UI-only fixture: no live account, provider calls or saved personal data.
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => { console.error('Preview page error:', error.message); });
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') return route.abort();
    if (url.pathname !== '/src/lib/use-fitness.ts') return route.continue();
    const original = await route.fetch();
    const react = (await original.text()).match(/from\s*["']([^"']*\/react\.js[^"']*)["']/)?.[1];
    if (!react) throw new Error('Could not locate preview React module');
    await route.fulfill({ contentType: 'application/javascript', body: `
      import React from ${JSON.stringify(react)};
      const { useState } = React;
      const entries = Array.from({length: 12}, (_, i) => ({
        id: 'synthetic-' + i, kind: 'meal', originalNote: 'Two eggs and rice', note: i === 3 ? 'Yogurt, sausage and cookie' : 'Two eggs and rice ' + i,
        details: i === 3 ? ['yogurt','sausage','cookie'].map(name=>({type:'food',name,amount:''})) : [{type:'food',name:'Eggs',amount:'2'},{type:'food',name:'Rice',amount:''}],
        pendingQuestion: i === 3 ? {itemIndex:0,field:'amount',text:'How much yogurt?'} : {itemIndex:1,field:'amount',text:'How much rice?'}, analysisStatus:i === 1 ? 'processing' : i === 2 ? 'failed' : 'ready',
        logged:false, version:1, createdAt:'2026-10-23T10:00:00Z',updatedAt:'2026-10-23T10:00:00Z'
      }));
      export function useFitness() {
        const [selected, setSelected] = useState(null);
        const [loading, setLoading] = useState(false);
        const [analyzingEntries, setAnalyzingEntries] = useState([]);
        const [notice, setNotice] = useState('');
        return {configured:true,authReady:true,user:{id:'synthetic',email:'demo@example.test'},
          entries,selected,loading,analyzingEntries,busy:false,error:'',notice,
          select:async id=>{setLoading(true);await new Promise(r=>setTimeout(r,30));setSelected({entry:entries.find(e=>e.id===id),messages:[{id:'message',role:'user',content:'Two eggs and rice'}]});setLoading(false)},
          capture:async()=>{setSelected({entry:entries[0],messages:[]});setNotice('Note saved.');return true},
          refresh:async()=>{},signOut:async()=>{},reply:async()=>{await new Promise(r=>setTimeout(r,350));setAnalyzingEntries([selected.entry.id]);setTimeout(()=>setAnalyzingEntries([]),1200);return true},saveDetails:async()=>true,
          editNote:async()=>true,setLogged:async()=>true,skipQuestion:async()=>true,analyze:async()=>{}
        };
      }
    ` });
  });
});

test('desktop organizes capture, inbox and review without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Two eggs and rice 0/ }).click();
  await expect(page.getByRole('heading', { name: 'Details to log' })).toBeVisible();
  const capture = await page.locator('.capture-panel').boundingBox();
  const inbox = await page.locator('.inbox').boundingBox();
  const review = await page.locator('.review-panel').boundingBox();
  expect(capture!.y + capture!.height).toBeLessThanOrEqual(inbox!.y);
  expect(Math.abs(capture!.x - inbox!.x)).toBeLessThanOrEqual(3);
  expect(Math.abs(capture!.width - inbox!.width)).toBeLessThanOrEqual(6);
  expect(inbox!.x + inbox!.width).toBeLessThanOrEqual(review!.x);
  expect(Math.abs(capture!.y - review!.y)).toBeLessThanOrEqual(1);
  expect(capture!.height).toBeLessThan(280);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/fitness-layout-desktop.png', fullPage: true });
});

test('mobile preserves capture and protects unsaved review work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const note = page.getByRole('textbox', { name: 'Your note', exact: true });
  await note.fill('Keep this capture draft');
  await note.focus();
  await expect(page.getByRole('button', { name: 'Use device dictation' })).toHaveCount(0);
  await expect(note).toBeFocused();
  await page.getByRole('navigation', { name: 'Notebook' }).getByRole('button', { name: /Inbox/ }).click();
  await expect(note).not.toBeVisible();
  await page.getByRole('button', { name: /Two eggs and rice 0/ }).click();
  await expect(page.getByRole('heading', { name: 'Details to log' })).toBeVisible();
  await page.screenshot({ path: '/tmp/fitness-layout-mobile-review.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Your reply' }).fill('One cup');
  await expect(page.getByRole('button', { name: 'Back to inbox' })).toBeDisabled();
  await page.getByRole('button', { name: 'Discard reply' }).click();
  await page.getByRole('button', { name: 'Back to inbox' }).click();
  await expect(page.getByRole('button', { name: /Two eggs and rice 0/ })).toBeFocused();
  await page.locator('.inbox').evaluate(element => { element.scrollTop = 200; });
  await page.getByRole('navigation', { name: 'Notebook' }).getByRole('button', { name: 'Capture', exact: true }).click();
  await expect(note).toHaveValue('Keep this capture draft');
  await page.getByRole('navigation', { name: 'Notebook' }).getByRole('button', { name: /Inbox/ }).click();
  expect(await page.locator('.inbox').evaluate(element => element.scrollTop)).toBe(200);
  await page.getByRole('navigation', { name: 'Notebook' }).getByRole('button', { name: 'Capture', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/fitness-layout-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Details to log' })).toBeVisible();
});

for (const width of [320, 768]) {
  test(`layout fits ${width}px viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('textbox', { name: 'Your note', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('status cues retain labels and loading respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Meal', exact: true })).toBeVisible();
  const processing = page.locator('.entry-status.status-processing');
  await expect(processing).toHaveText('Preparing details');
  expect(await processing.locator('.loading-spinner').evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(page.locator('.entry-status.status-retry')).toHaveText('Retry details');
  await expect(page.locator('.entry-status.status-question').first()).toHaveText('Optional details');
  expect(await processing.locator('svg').getAttribute('aria-hidden')).toBe('true');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  expect(await processing.locator('.loading-spinner').evaluate(element => getComputedStyle(element).animationName)).toBe('loading-turn');
});

test('Enter shows immediate reply feedback through save and background analysis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Notebook' }).getByRole('button', { name: /Inbox/ }).click();
  await page.getByRole('button', { name: /Two eggs and rice 0/ }).click();
  const answer = page.getByRole('textbox', { name: 'Your reply' });
  await answer.fill('One cup');
  await answer.press('Enter');
  await expect(page.getByRole('button', { name: 'Saving reply…', exact: true })).toBeDisabled();
  await expect(page.getByText('Saving your reply…', { exact: true })).toBeVisible();
  await expect(page.getByText('Preparing details… Your saved note and replies are safe.', { exact: true })).toBeVisible();
  await expect(page.locator('.question .loading-spinner').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Preparing details…', exact: true })).toBeDisabled();
  await expect(answer).toHaveValue('');
  await page.screenshot({ path: '/tmp/fitness-reply-loading.png', fullPage: true });
  await expect(page.getByRole('button', { name: 'Save reply', exact: true })).toBeVisible();
});

test('resizing keeps simulated recording and reply drafts reachable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'SpeechRecognition', { value: class {
      onstart?: () => void; onend?: () => void;
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() {}
    } });
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await page.getByRole('button', { name: /Two eggs and rice 0/ }).click();
  await page.locator('.capture-panel').getByRole('button', { name: 'Record', exact: true }).click();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.locator('.review-panel').getByRole('button', { name: 'Record', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Stop recording', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Stop recording', exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 900 });
  const reply = page.getByRole('textbox', { name: 'Your reply' });
  await reply.fill('One cup');
  await expect(page.locator('.capture-panel').getByRole('button', { name: 'Record', exact: true })).toBeDisabled();
  await expect(reply).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(reply).toBeVisible();
  await expect(reply).toHaveValue('One cup');
  await expect(page.getByRole('button', { name: 'Discard reply' })).toBeVisible();
});

test('all optional questions appear together with a single reply box', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Notebook' }).getByRole('button', { name: /Inbox/ }).click();
  await page.getByRole('button', { name: /Yogurt, sausage and cookie/ }).click();
  for (const name of ['yogurt', 'sausage', 'cookie']) await expect(page.getByText(`What amount did you record for ${name}?`, { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Your reply' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Skip all', exact: true })).toBeEnabled();
  await page.screenshot({ path: '/tmp/fitness-batch-questions.png', fullPage: true });
  await page.getByRole('textbox', { name: 'Your reply' }).fill('yogurt: one cup; sausage: two links; cookie: one');
  await page.getByRole('textbox', { name: 'Your reply' }).press('Enter');
  await expect(page.getByRole('button', { name: 'Saving reply…', exact: true })).toBeDisabled();
  await expect(page.getByText('Preparing details… Your saved note and replies are safe.', { exact: true })).toBeVisible();
});

test('success appears as a dismissible fixed toast without shifting the notebook', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const before = await page.locator('.capture-panel').boundingBox();
  const beforeScroll = await page.evaluate(() => scrollY);
  await page.getByRole('textbox', { name: 'Your note', exact: true }).fill('Synthetic lunch');
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  const toast = page.locator('.confirmation-toast');
  await expect(toast.getByRole('status')).toHaveText('Note saved.');
  expect(await toast.evaluate(element => getComputedStyle(element).position)).toBe('fixed');
  const after = await page.locator('.capture-panel').boundingBox();
  expect(after!.y + await page.evaluate(() => scrollY)).toBe(before!.y + beforeScroll);
  await page.screenshot({ path: '/tmp/fitness-confirmation-toast.png', fullPage: true });
  await expect(page.locator('.app-message')).toHaveCount(0);
  await page.getByRole('button', { name: 'Dismiss confirmation' }).click();
  await expect(toast).toHaveCount(0);
});
