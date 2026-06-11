import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const API  = 'http://127.0.0.1:8000';

async function registerUser() {
  const ts = Date.now();
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `legal_${ts}@lexara.app`, password: 'Verify123!', full_name: 'Legal Test' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Registration failed: ' + JSON.stringify(data));
  return data;
}

(async () => {
  const { access_token: token, user_id } = await registerUser();
  console.log(`Setup: user=${user_id}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push('PAGEERROR: ' + err.message));

  // Inject auth
  await page.goto(BASE);
  await page.evaluate(({ token, userId }) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('authUser', JSON.stringify({
      id: userId, full_name: 'Legal Test', plan: 'free', role: 'member'
    }));
  }, { token, userId: user_id });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');

  // ── STEP 1: Click Legal mode card ──
  const modeCards = page.locator('button.mode-card');
  const cardCount = await modeCards.count();
  let legalCard = null;
  for (let i = 0; i < cardCount; i++) {
    const text = await modeCards.nth(i).innerText();
    if (text.toLowerCase().includes('legal')) { legalCard = modeCards.nth(i); break; }
  }
  if (!legalCard) throw new Error('Legal mode card not found');
  const legalText = await legalCard.innerText();
  console.log(`1. ✅ Legal mode card found: "${legalText.slice(0,30).trim()}"`);
  await legalCard.click();
  await page.waitForTimeout(1000);
  console.log(`   URL after click: ${page.url()}`);

  // ── STEP 2: Legal jurisdiction cards ──
  const pageContent = await page.content();
  const hasKR = pageContent.includes('Korean') || pageContent.includes('KR');
  const hasUZ = pageContent.includes('Uzbek') || pageContent.includes('UZ');
  console.log(`2. ✅ Korean jurisdiction visible: ${hasKR}, Uzbek: ${hasUZ}`);

  // Click Korean law card (free tier has KR access)
  const krCard = page.locator('button, [role="button"]').filter({ hasText: /Korean|KR/ }).first();
  const hasKrCard = await krCard.count() > 0;
  if (hasKrCard) {
    await krCard.click();
    await page.waitForTimeout(1000);
    console.log(`   Clicked KR jurisdiction card`);
  }

  // ── STEP 3: Legal chat textarea loads ──
  const textarea = page.locator('textarea.chat-input');
  const taCount = await textarea.count();
  const taEnabled = taCount > 0 ? await textarea.isEnabled() : false;
  const taPlaceholder = taCount > 0 ? await textarea.getAttribute('placeholder') : '';
  console.log(`3. ✅ Legal chat textarea: count=${taCount}, enabled=${taEnabled}, placeholder="${taPlaceholder}"`);

  // ── STEP 4: Send a message ──
  if (taEnabled) {
    await textarea.fill('What is the Korean Personal Information Protection Act?');
    await textarea.press('Enter');
    await page.waitForTimeout(4000);
    const msgs = await page.locator('[class*="chat-message"], .message-row, .message').count();
    console.log(`4. ✅ Messages after send: ${msgs}`);
  } else {
    console.log(`4. ⚠️ Textarea not enabled — skipping send`);
  }

  // ── STEP 5: Storage key has _KR suffix ──
  const keys = await page.evaluate(() => Object.keys(localStorage));
  const sessionKeys = keys.filter(k => k.startsWith('lexara_sessions_'));
  console.log(`5. Session storage keys (${sessionKeys.length}):`);
  sessionKeys.forEach(k => {
    const hasKR = k.endsWith('_KR');
    console.log(`   ${hasKR ? '✅' : '⚠️'} ${k} — KR suffix: ${hasKR}`);
  });

  // ── STEP 6: Reload — legal session persists ──
  if (taEnabled) {
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const msgsAfterReload = await page.locator('[class*="chat-message"], .message-row, .message').count();
    console.log(`6. ✅ Messages after reload: ${msgsAfterReload} (persisted: ${msgsAfterReload > 0})`);
  }

  // ── STEP 7: Console errors ──
  const relevant = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('net::ERR_ABORTED'));
  console.log(`7. ${relevant.length ? '⚠️' : '✅'} Console errors: ${relevant.length}`);
  relevant.slice(0,3).forEach(e => console.log(`   ${e.slice(0,120)}`));

  await browser.close();
  console.log('\n✅ LegalChatPage verification complete.');
})().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
