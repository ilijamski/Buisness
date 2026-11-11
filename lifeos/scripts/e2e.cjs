const { chromium } = require('playwright');
// End-to-End-Rauchtest aller Bereiche. Voraussetzung: laufende App und installiertes Playwright.
// Aufruf: BASE_URL=http://localhost:3000 node scripts/e2e.cjs
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOTS = process.env.SHOTS_DIR; // optional: Ordner für Screenshots
const email = `test${Date.now()}@example.com`;
const results = [];
// Alle Datumsangaben relativ zu heute, damit der Lauf an jedem Tag funktioniert.
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const day = (offset) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return d; };
const isoWeek = (date) => { const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
const nextMonth = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 1); })();
const ok = (name, cond, extra='') => { results.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  const shot = (n) => (SHOTS ? page.screenshot({ path: `${SHOTS}/${n}.png` }) : null);
  const toast = async (text) => { await page.getByText(text, { exact: true }).first().waitFor({ timeout: 8000 }); };

  // --- Auth
  await page.goto(BASE + '/dashboard');
  ok('redirect to login when logged out', page.url().endsWith('/login'));
  await shot('01-login');
  await page.goto(BASE + '/registrieren');
  await page.fill('input[name=name]', 'Mara Testerin');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'kurz');
  await page.evaluate(() => document.querySelector('input[name=password]').removeAttribute('minlength'));
  await page.click('button[type=submit]');
  await page.locator('p[role=alert]').waitFor();
  ok('short password rejected by server', (await page.locator('p[role=alert]').first().innerText()).includes('8 Zeichen'));
  await page.fill('input[name=password]', 'geheim-1234');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
  ok('register → dashboard', true);
  await page.getByText('Willkommen bei LifeOS').waitFor();
  await shot('02-onboarding');

  // --- Demo data
  await page.getByRole('button', { name: 'Beispieldaten laden' }).click();
  await page.getByText('Im Fokus').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await shot('03-dashboard');
  ok('dashboard shows focus tasks', await page.getByText('Steuererklärung abgeben').count() > 0);

  // toggle a task on dashboard
  await page.getByRole('checkbox', { name: '„Steuererklärung abgeben“ erledigen' }).click();
  await page.getByRole('checkbox', { name: '„Steuererklärung abgeben“ wieder öffnen' }).waitFor({ timeout: 5000 }).then(() => ok('task toggle (optimistic+persisted)', true)).catch(() => ok('task toggle', false));
  await page.waitForTimeout(600);
  // habit toggle on dashboard
  const habit = page.getByRole('checkbox', { name: 'Sport: offen' });
  await habit.click();
  await page.getByRole('checkbox', { name: 'Sport: erledigt' }).waitFor({ timeout: 5000 }).then(() => ok('habit toggle on dashboard', true)).catch(() => ok('habit toggle on dashboard', false));

  // --- Tasks
  await page.goto(BASE + '/aufgaben');
  await page.getByPlaceholder('Aufgabe schnell erfassen').fill('E2E Schnellaufgabe');
  await page.keyboard.press('Enter');
  await page.getByText('E2E Schnellaufgabe').waitFor();
  ok('quick add task', true);
  await page.getByText('E2E Schnellaufgabe').click();
  await page.locator('dialog[open] select[name=priority]').selectOption('urgent');
  await page.locator('dialog[open] input[name=dueDate]').fill(iso(day(1)));
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Aufgabe gespeichert');
  ok('edit task', await page.locator('section', { hasText: 'E2E Schnellaufgabe' }).getByText('Dringend').count() > 0);
  await page.waitForTimeout(500);
  await shot('04-aufgaben');
  await page.getByPlaceholder('Suchen').fill('zzzz-nichts');
  ok('search empty state', await page.getByText('Keine Treffer').count() > 0);
  await page.getByPlaceholder('Suchen').fill('');
  await page.getByRole('radio', { name: 'Erledigt' }).click();
  ok('done filter shows completed', await page.getByText('Steuererklärung abgeben').count() > 0);
  // delete
  await page.getByRole('radio', { name: 'Offen' }).click();
  await page.getByText('E2E Schnellaufgabe').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Löschen' }).click();
  await toast('Aufgabe gelöscht');
  await page.waitForTimeout(400);
  ok('delete task', await page.getByText('E2E Schnellaufgabe').count() === 0);

  // wiederkehrende Aufgabe: Erledigen legt die nächste an
  await page.getByRole('button', { name: 'Neue Aufgabe' }).click();
  await page.locator('dialog[open] input[name=title]').fill('E2E Wiederkehrend');
  await page.locator('dialog[open] input[name=dueDate]').fill(iso(day(0)));
  await page.locator('dialog[open] select[name=repeat]').selectOption('weekly');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Aufgabe angelegt');
  await page.getByRole('checkbox', { name: '„E2E Wiederkehrend“ erledigen' }).click();
  await page.getByText(/Nächste Wiederholung/).waitFor({ timeout: 8000 });
  await page.waitForTimeout(500);
  const nextTask = page.locator('div[role=button]', { hasText: 'E2E Wiederkehrend' });
  const spawned = (await (await page.request.get(BASE + '/api/export')).json()).tasks.filter((t) => t.title === 'E2E Wiederkehrend');
  ok('recurring task spawns next occurrence', await nextTask.count() === 1 && await nextTask.getByText('Wöchentlich').count() === 1
    && spawned.length === 2 && spawned.some((t) => t.status === 'todo' && t.dueDate === iso(day(7)) && t.repeat === 'weekly'));

  // --- Calendar
  await page.goto(BASE + '/kalender');
  await page.waitForTimeout(600);
  await shot('05-kalender');
  await page.getByRole('button', { name: 'Neuer Termin' }).click();
  await page.locator('dialog[open] input[name=title]').fill('E2E Termin');
  await page.locator('dialog[open] input[name=startTime]').fill('15:00');
  await page.locator('dialog[open] input[name=endTime]').fill('14:00');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Das Ende muss nach dem Beginn liegen.');
  ok('event validation end<start', true);
  await page.locator('dialog[open] input[name=endTime]').fill('16:00');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Termin angelegt');
  ok('create event', await page.getByText('E2E Termin').count() > 0);
  // Serientermin: wöchentlich, erscheint in späteren Wochen am selben Wochentag
  const agenda = page.locator('section[aria-live]');
  const openDay = async (offset) => { await page.goto(`${BASE}/kalender?d=${iso(day(offset))}`); await agenda.waitFor(); await page.waitForTimeout(300); };
  await page.getByRole('button', { name: 'Neuer Termin' }).click();
  await page.locator('dialog[open] input[name=title]').fill('E2E Serie');
  await page.locator('dialog[open]').getByLabel('Wiederholen').selectOption('weekly');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Termin angelegt');
  await openDay(14);
  ok('weekly series occurs on later weeks', await agenda.getByText('E2E Serie').count() === 1);
  await openDay(13);
  ok('weekly series absent on other weekdays', await agenda.getByText('E2E Serie').count() === 0);
  // Mehrtägiger Termin
  await page.getByRole('button', { name: 'Neuer Termin' }).click();
  await page.locator('dialog[open] input[name=title]').fill('E2E Reise');
  await page.locator('dialog[open] input[name=date]').fill(iso(day(20)));
  await page.locator('dialog[open] input[name=endDate]').fill(iso(day(19)));
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Der letzte Tag darf nicht vor dem ersten liegen.');
  await page.locator('dialog[open] input[name=endDate]').fill(iso(day(22)));
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Termin angelegt');
  await openDay(21);
  ok('multi-day event covers middle day', await agenda.getByText('E2E Reise').count() === 1);
  await shot('05b-kalender-serien');
  await openDay(23);
  ok('multi-day event ends on last day', await agenda.getByText('E2E Reise').count() === 0);
  // „Diesen und alle folgenden“ löschen: frühere Termine bleiben
  await openDay(14);
  await agenda.getByText('E2E Serie').click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Löschen' }).click();
  await page.getByRole('button', { name: 'Diesen und alle folgenden' }).click();
  await toast('Folgende Termine gelöscht');
  await openDay(14);
  const gone = await agenda.getByText('E2E Serie').count() === 0;
  await openDay(7);
  ok('delete this-and-following keeps earlier occurrences', gone && await agenda.getByText('E2E Serie').count() === 1);
  await page.goto(BASE + '/kalender');
  await page.getByRole('link', { name: 'Nächster Monat' }).click();
  await page.waitForURL(`**m=${iso(nextMonth).slice(0, 7)}`);
  ok('calendar month nav', await page.getByText(new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' }).format(nextMonth)).count() > 0);

  // --- Goals
  await page.goto(BASE + '/ziele');
  await page.waitForTimeout(900);
  await shot('06-ziele');
  const card = page.locator('article', { hasText: 'Halbmarathon laufen' });
  await card.getByRole('button', { name: '1 mehr' }).click();
  await card.getByText('15 km').first().waitFor({ timeout: 5000 }).then(() => ok('goal increment', true)).catch(() => ok('goal increment', false));
  await page.getByRole('button', { name: 'Neues Ziel' }).click();
  await page.locator('dialog[open] input[name=title]').fill('E2E Ziel');
  await page.locator('dialog[open] input[name=current]').fill('2,5');
  await page.locator('dialog[open] input[name=target]').fill('10');
  await page.locator('dialog[open] input[name=unit]').fill('km');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Ziel angelegt');
  ok('create goal w/ decimal comma', await page.locator('article', { hasText: 'E2E Ziel' }).getByText('25%').count() > 0);

  // --- Habits
  await page.goto(BASE + '/gewohnheiten');
  await page.waitForTimeout(900);
  await shot('07-gewohnheiten');
  await page.getByRole('button', { name: 'Neue Gewohnheit' }).click();
  await page.locator('dialog[open] input[name=name]').fill('E2E Gewohnheit');
  await page.locator('dialog[open]').getByRole('radio', { name: 'Grün' }).click();
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Gewohnheit angelegt');
  const row = page.locator('li', { hasText: 'E2E Gewohnheit' });
  await row.getByRole('checkbox').last().click();
  await row.getByText('1 Tag in Folge').waitFor({ timeout: 5000 }).then(() => ok('habit create + check + streak', true)).catch(() => ok('habit streak', false));

  // --- Notes
  await page.goto(BASE + '/notizen');
  await page.waitForTimeout(600);
  await shot('08-notizen');
  await page.getByRole('button', { name: 'Neue Notiz' }).click();
  await page.getByText('Ohne Titel').first().waitFor();
  await page.getByLabel('Titel der Notiz').fill('E2E Notiz');
  await page.getByLabel('Inhalt der Notiz').fill('Automatisch gespeicherter Inhalt.');
  await page.getByText('Gespeichert', { exact: true }).waitFor({ timeout: 8000 });
  await page.reload();
  await page.getByRole('button', { name: /E2E Notiz/ }).click();
  ok('note autosave persisted', (await page.getByLabel('Inhalt der Notiz').inputValue()) === 'Automatisch gespeicherter Inhalt.');

  // --- Finance
  await page.goto(BASE + '/finanzen');
  await page.waitForTimeout(1200);
  await shot('09-finanzen');
  await page.getByRole('button', { name: 'Neue Buchung' }).click();
  await page.locator('dialog[open] input[name=amount]').fill('1.234,56');
  await page.locator('dialog[open] input[name=description]').fill('E2E Buchung');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Buchung angelegt');
  ok('create transaction with 1.234,56', await page.getByText('− 1.234,56 €').count() > 0);
  // Konten und Kontoauszug-Import
  await page.getByRole('button', { name: 'Konto', exact: true }).click();
  await page.locator('dialog[open] input[name=name]').fill('E2E Bank');
  await page.locator('dialog[open] input[name=opening]').fill('1.000');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Konto angelegt');
  const d = (offset) => { const x = day(offset); return `${pad(x.getDate())}.${pad(x.getMonth() + 1)}.${x.getFullYear()}`; };
  // Wie ein echter Bankexport: Vorspann, Semikolon, Windows-1252, Summenzeile, zwei identische Buchungen
  const csv = [
    '"Girokonto";"DE00 0000"', '',
    '"Buchungstag";"Wertstellung";"Beguenstigter/Zahlungspflichtiger";"Verwendungszweck";"Betrag (EUR)"',
    `"${d(0)}";"${d(0)}";"REWE Markt GmbH";"Einkauf";"-42,17"`,
    `"${d(0)}";"${d(0)}";"Bäckerei Müller";"Brötchen";"-3,80"`,
    `"${d(0)}";"${d(0)}";"Bäckerei Müller";"Brötchen";"-3,80"`,
    `"${d(-1)}";"${d(-1)}";"Muster AG";"Gehalt";"2.500,00"`,
    '"Summe";"";"";"";""',
  ].join('\r\n');
  const file = { name: 'umsaetze.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'latin1') };
  const openImport = async () => {
    await page.getByRole('button', { name: 'Kontoauszug importieren' }).click();
    await page.locator('dialog[open] select[name=accountId]').selectOption({ label: 'E2E Bank' });
    await page.locator('dialog[open] input[type=file]').setInputFiles(file);
  };
  await openImport();
  await page.getByText('4 neue Buchungen').waitFor({ timeout: 10000 });
  ok('import preview: umlauts decoded, salary categorised', await page.locator('dialog[open]').getByText('Bäckerei Müller').count() === 2
    && await page.locator('dialog[open]').getByText(/Gehalt$/).count() > 0 && await page.locator('dialog[open]').getByText(/1 Zeilen ohne Buchung/).count() === 1);
  await shot('09d-import');
  await page.getByRole('button', { name: '4 Buchungen importieren' }).click();
  await toast('4 Buchungen importiert');
  await page.waitForTimeout(500);
  // 1.000 Anfangsstand + 2.500 − 42,17 − 3,80 − 3,80
  ok('account balance = opening + imported', await page.locator('li', { hasText: 'E2E Bank' }).getByText('3.450,23 €').count() === 1);
  await openImport();
  await page.getByText('0 neue Buchungen · 4 bereits vorhanden').waitFor({ timeout: 10000 });
  ok('re-import detects all duplicates', await page.getByRole('button', { name: 'Importieren', exact: true }).isDisabled());
  await page.locator('dialog[open]').getByRole('button', { name: 'Abbrechen' }).click();
  // Konto-Filter
  await page.getByRole('link', { name: /E2E Bank/ }).click();
  await page.waitForURL('**k=*');
  await page.getByText('Nur Konto „E2E Bank“').waitFor();
  ok('account filter limits totals', await page.getByText('2.500,00 €').first().isVisible() && await page.getByText('49,77 €').count() > 0);
  await shot('09e-konto');
  await page.getByRole('link', { name: /E2E Bank/ }).click();
  await page.waitForURL((u) => !u.search.includes('k='));
  await page.waitForTimeout(400);
  // Budgets
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click();
  await page.locator('dialog[open] input[name=housing]').fill('1.000');
  await page.locator('dialog[open] button[type=submit]').click();
  await toast('Budgets gespeichert');
  await page.waitForTimeout(400);
  ok('budget shows overspend', await page.getByText(/über dem Budget/).count() > 0);
  await shot('09c-budgets');
  // chart hover
  const bars = page.getByRole('img', { name: /Einnahmen und Ausgaben je Monat/ });
  const bb = await bars.boundingBox();
  await page.mouse.move(bb.x + bb.width - 40, bb.y + 60);
  await page.waitForTimeout(200);
  ok('bar chart tooltip', await bars.getByText('Einnahmen').count() > 0);
  await shot('09b-finanzen-hover');

  // --- Projects
  await page.goto(BASE + '/projekte');
  await page.waitForTimeout(900);
  await shot('10-projekte');
  await page.getByRole('link', { name: /Website-Relaunch/ }).click();
  await page.waitForURL('**/projekte/*');
  await page.waitForTimeout(700);
  await shot('11-projekt-board');
  // drag card todo → in progress
  const src = page.locator('li[draggable=true]', { hasText: 'Blog-Layout bauen' });
  const dst = page.getByRole('region', { name: 'In Arbeit' });
  await src.dragTo(dst);
  await page.waitForTimeout(800);
  ok('kanban drag to In Arbeit', await dst.getByText('Blog-Layout bauen').count() > 0);
  await page.reload();
  ok('kanban drag persisted', await page.getByRole('region', { name: 'In Arbeit' }).getByText('Blog-Layout bauen').count() > 0);
  await page.goto(BASE + '/projekte');
  await page.getByRole('button', { name: 'Neues Projekt' }).click();
  await page.locator('dialog[open] input[name=name]').fill('E2E Projekt');
  await page.locator('dialog[open] button[type=submit]').click();
  await page.waitForURL('**/projekte/*');
  ok('create project → board', await page.getByRole('heading', { name: 'E2E Projekt' }).count() > 0);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Löschen' }).click();
  await page.locator('dialog[open]').getByRole('button', { name: 'Löschen' }).click();
  await page.waitForURL('**/projekte');
  ok('delete project', true);

  // --- Stats
  await page.goto(BASE + '/statistiken');
  await page.waitForTimeout(1200);
  await shot('12-statistiken');
  ok('weekly report text', await page.getByText(/In dieser Woche hast du bisher/).count() > 0);
  await page.getByRole('link', { name: 'Vorherige Woche' }).click();
  await page.waitForURL('**w=*');
  ok('stats week nav', await page.getByText(new RegExp(`KW ${isoWeek(day(-7))} `)).count() > 0);

  // --- Command palette
  await page.keyboard.press('Control+k');
  await page.getByLabel('Suchen oder Aufgabe anlegen').fill('Finan');
  await page.waitForTimeout(200);
  await shot('13-palette');
  await page.keyboard.press('Enter');
  await page.waitForURL('**/finanzen');
  ok('command palette navigation', true);

  // Suche über Inhalte
  await page.keyboard.press('Control+k');
  await page.getByLabel('Suchen oder Aufgabe anlegen').fill('deep work');
  await page.getByRole('option', { name: /Buchnotizen: Deep Work/ }).waitFor({ timeout: 8000 });
  await shot('13b-suche');
  await page.getByRole('option', { name: /Buchnotizen: Deep Work/ }).click();
  await page.waitForURL('**/notizen?id=*');
  ok('search opens found note', (await page.getByLabel('Titel der Notiz').inputValue()) === 'Buchnotizen: Deep Work');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Suchen oder Aufgabe anlegen').fill('100%_');
  await page.waitForTimeout(900);
  ok('search treats % and _ literally', await page.getByRole('option').count() === 1);
  await page.keyboard.press('Escape');

  // --- Settings
  await page.goto(BASE + '/einstellungen');
  await page.waitForTimeout(600);
  await shot('14-einstellungen');
  await page.fill('input[name=name]', 'Mara Neu');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await toast('Profil gespeichert');
  ok('update profile', true);
  await page.fill('input[name=current]', 'falsch');
  await page.fill('input[name=next]', 'neues-passwort-1');
  await page.getByRole('button', { name: 'Passwort ändern' }).click();
  await toast('Das aktuelle Passwort stimmt nicht.');
  await page.fill('input[name=current]', 'geheim-1234');
  await page.getByRole('button', { name: 'Passwort ändern' }).click();
  await toast('Passwort geändert');
  ok('change password', true);
  const exp = await page.request.get(BASE + '/api/export');
  const json = await exp.json();
  ok('export json', exp.ok() && json.tasks.length > 10 && !('userId' in json.tasks[0]) && !JSON.stringify(json).includes('passwordHash'), `tasks=${json.tasks.length}`);

  // --- Logout / login
  await page.locator('aside form button[aria-label=Abmelden]').click();
  await page.waitForURL('**/login');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'geheim-1234');
  await page.click('button[type=submit]');
  await page.locator('p[role=alert]').waitFor();
  ok('old password rejected', true);
  await page.fill('input[name=password]', 'neues-passwort-1');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard');
  await page.getByText('Im Fokus').waitFor({ timeout: 10000 });
  ok('login with new password, data persisted', await page.getByText('Mara Neu').count() > 0);

  // --- Isolation: second user sees nothing; cannot touch first user's task
  const taskId = json.tasks[0].id;
  const ctx2 = await browser.newContext({ locale: 'de-DE' });
  const p2 = await ctx2.newPage();
  await p2.goto(BASE + '/registrieren');
  await p2.fill('input[name=name]', 'Zweiter');
  await p2.fill('input[name=email]', 'b' + email);
  await p2.fill('input[name=password]', 'geheim-1234');
  await p2.click('button[type=submit]');
  await p2.waitForURL('**/dashboard');
  await p2.getByText('Willkommen bei LifeOS').waitFor({ timeout: 10000 });
  ok('second user starts empty', true);
  const exp2 = await (await p2.request.get(BASE + '/api/export')).json();
  ok('second user export empty', exp2.tasks.length === 0 && exp2.notes.length === 0 && exp2.accounts.length === 0);
  // Import in ein fremdes Konto muss scheitern
  await p2.goto(BASE + '/finanzen');
  await p2.getByRole('button', { name: 'Konto', exact: true }).click();
  await p2.locator('dialog[open] input[name=name]').fill('Eigenes');
  await p2.locator('dialog[open] button[type=submit]').click();
  await p2.getByText('Konto angelegt', { exact: true }).waitFor();
  await p2.getByRole('button', { name: 'Kontoauszug importieren' }).click();
  await p2.evaluate((foreign) => { const sel = document.querySelector('dialog[open] select[name=accountId]'); sel.options[0].value = foreign; }, json.accounts[0].id);
  await p2.locator('dialog[open] input[type=file]').setInputFiles({ name: 'x.csv', mimeType: 'text/csv', buffer: Buffer.from('Datum;Betrag\n01.01.2026;-1,00\n') });
  await p2.locator('dialog[open] p[role=alert]').waitFor({ timeout: 10000 });
  ok('import into foreign account rejected', (await p2.locator('dialog[open] p[role=alert]').innerText()).includes('Konto auswählen'));
  const projId = json.projects[0].id;
  await p2.goto(BASE + '/projekte/' + projId);
  await p2.getByText('Diese Seite gibt es nicht').waitFor({ timeout: 10000 });
  ok('foreign project is not accessible', (await p2.getByText(json.projects[0].name).count()) === 0);
  // duplicate email
  const ctx3 = await browser.newContext();
  const p3 = await ctx3.newPage();
  await p3.goto(BASE + '/registrieren');
  await p3.fill('input[name=name]', 'Dup'); await p3.fill('input[name=email]', email.toUpperCase()); await p3.fill('input[name=password]', 'geheim-1234');
  await p3.click('button[type=submit]');
  await p3.locator('p[role=alert]').waitFor();
  ok('duplicate email (case-insensitive) rejected', (await p3.locator('p[role=alert]').first().innerText()).includes('bereits'));

  // --- Mobile screenshots
  const m = await browser.newContext({ ...require('playwright').devices['iPhone 14'], locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  await m.addCookies(await ctx.cookies());
  const mp = await m.newPage();
  mp.on('console', msg => { if (msg.type() === 'error') errors.push('MOBILE ' + msg.text()); });
  for (const [path, name] of [['dashboard','m1-dashboard'],['aufgaben','m2-aufgaben'],['kalender','m3-kalender'],['gewohnheiten','m4-gewohnheiten'],['finanzen','m5-finanzen'],['notizen','m6-notizen'],['statistiken','m7-statistiken'],['ziele','m8-ziele']]) {
    await mp.goto(BASE + '/' + path);
    await mp.waitForTimeout(1200);
    if (SHOTS) await mp.screenshot({ path: `${SHOTS}/${name}.png` });
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`mobile no horizontal overflow /${path}`, overflow <= 0, `overflow=${overflow}`);
  }
  await mp.goto(BASE + '/projekte'); await mp.getByRole('link', { name: /Website-Relaunch/ }).click(); await mp.waitForTimeout(1000);
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/m9-board.png` });
  await mp.goto(BASE + '/dashboard'); await mp.getByRole('button', { name: 'Mehr' }).click(); await mp.waitForTimeout(500);
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/m10-mehr.png` });
  await mp.goto(BASE + '/aufgaben'); await mp.getByRole('button', { name: 'Neue Aufgabe' }).click(); await mp.waitForTimeout(500);
  if (SHOTS) await mp.screenshot({ path: `${SHOTS}/m11-dialog.png` });

  console.log(results.join('\n'));
  console.log('\nConsole errors:', errors.length); errors.slice(0, 15).forEach(e => console.log(' -', e.slice(0, 300)));
  await browser.close();
  if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
})().catch(e => { console.log(results.join('\n')); console.error('CRASH', e.message.slice(0, 1500)); process.exit(1); });
