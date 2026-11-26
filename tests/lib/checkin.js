'use strict';
// Drives the real check-in wizard to a saved session by answering every
// question with its first option, through the real radio inputs. Starts from
// whatever view is showing; ends on the dashboard the app switches to after Save.
async function completeCheckIn(page, opts) {
  opts = opts || {};
  await page.click('#tab-flow');
  await page.waitForTimeout(200);
  // A planned session today would put a landing screen first; take the manual way in.
  const unplanned = await page.$('text=Log an unplanned session');
  if (unplanned) { await unplanned.click(); await page.waitForTimeout(200); }
  for (let i = 0; i < 60; i++) {
    const label = (await page.textContent('#btn-next')).trim();
    if (label === 'Save') { await page.click('#btn-next'); await page.waitForTimeout(250); return; }
    const groups = await page.$$eval('.flow-body input[type=radio]', (ns) => Array.from(new Set(ns.map((n) => n.name))));
    let answered = false;
    for (const g of groups) {
      const done = await page.$('.flow-body input[type=radio][name="' + g + '"]:checked');
      if (done) continue;
      await page.locator('.flow-body input[type=radio][name="' + g + '"]').first().check({ force: true });
      answered = true;
      break;
    }
    if (!answered) await page.click('#btn-next');
    await page.waitForTimeout(550); // auto-progress is debounced 450ms (decision 35)
  }
  throw new Error('could not complete the check-in wizard' + (opts.what ? ' (' + opts.what + ')' : ''));
}
module.exports = { completeCheckIn };
