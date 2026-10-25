import { readFile, writeFile } from 'node:fs/promises';

const font = await readFile(
  new URL('../../../apps/web/src/assets/inter-variable.woff2', import.meta.url),
);
const counts = {};
let prefix = 'I';
const number = () => {
  counts[prefix] = (counts[prefix] ?? 0) + 1;
  const id = `${prefix}${String(counts[prefix]).padStart(2, '0')}`;
  return `<span class="pen" id="${id}">${id}</span>`;
};
const p = (text, cls = '') => `<p class="${cls}">${number()}${text}</p>`;
const button = (text, cls = '') =>
  `<button disabled class="button ${cls}">${number()}${text}</button>`;
const original =
  'קפה קטן בגינה 🍋\nשלום · é · é\n"Remind me Friday", a quoted message.';
const sproutMark = `<svg class="sprout-symbol" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 29V15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M16 17C15 11 10.5 8 5 8.4 5.2 14 9.6 17.4 16 17ZM16 14C16.6 7.8 21 4 27.4 4 27.5 10.4 23 14 16 14Z" fill="currentColor"/></svg>`;
const canopy = (title, line) =>
  `<div class="canopy">${greenhouse()}<div class="canopy-copy"><h3>${number()}${title}</h3>${p(line, 'canopy-description')}</div></div>`;
const greenhouse = () =>
  `<div class="greenhouse-art" aria-hidden="true"><div class="arch arch-one"></div><div class="arch arch-two"></div><div class="arch arch-three"></div><div class="glass-shelf"><i></i><i></i><i></i></div></div>`;
const rail = (selected) =>
  `<aside class="rail"><div class="wordmark">${number()}${sproutMark}sprout</div><nav>${p('Library', selected === 'library' ? 'selected' : '')}${p('Find and ask')}${p('Spaces', selected === 'spaces' ? 'selected' : '')}${p('Settings')}</nav><div class="rail-bottom">${sproutMark}${p('Beds for what you keep.', 'rail-note')}</div></aside>`;
const mobileTop = (label) =>
  `<div class="mobile-top">${number()}${sproutMark}sprout<span>${label}</span></div>`;
const shadcn = (name) => `<p class="shadcn">${name}</p>`;
const bed = (title, count, tone = 'sage') =>
  `<article class="bed ${tone}"><div class="bed-art"><span>Space</span></div><div class="bed-copy"><h4>${number()}${title}</h4><p class="bed-excerpt" dir="auto">${original.split('\n')[0]}</p>${p(`${count} in this bed`, 'muted')}<span class="badge">${number()}${count}</span></div></article>`;
const card = (actions = true, keyboard = false) =>
  `<article class="saved-card${keyboard ? ' is-focus' : ''}"><div class="card-art"><span>Original text</span></div><div class="card-copy"><div class="card-top">${number()}<span class="chip">New</span><span class="muted">Today</span></div><div class="original-preview original-field" dir="auto">${number()}${original.split('\n')[0]}</div>${p('Keep for a quiet Friday.', 'muted')}${
    actions
      ? `<div class="card-actions">${button('Add')}${button('Move', keyboard ? 'primary' : '')}${button('Remove')}</div>${keyboard ? p('Tab to Move. Enter confirms. Escape closes.', 'kbd-note') : ''}`
      : ''
  }</div></article>`;
const emptyBed = (title, body, action) =>
  `<div class="empty"><div class="seed" aria-hidden="true"></div>${p(title, 'empty-title')}${p(body, 'muted')}${button(action, 'primary')}</div>`;

function specimen(id, theme, phone, body, caption) {
  return `<article class="specimen" id="${id}-${theme}-${phone ? 'phone' : 'desktop'}"><div class="spec-caption">${number()}${caption} / ${theme}<span>${phone ? 'Galaxy S9+ frame' : 'Desktop 1440'}</span></div><div class="screen ${theme} ${phone ? 'phone' : 'desktop'}">${body}</div></article>`;
}

function pair(id, caption, desktop, phone) {
  return `${specimen(id, 'light', false, desktop(), caption)}${specimen(id, 'dark', false, desktop(), caption)}<div class="phones">${specimen(id, 'light', true, phone(), caption)}${specimen(id, 'dark', true, phone(), caption)}</div>`;
}

const withPrefix = (next, build) => {
  const previous = prefix;
  prefix = next;
  const html = build();
  prefix = previous;
  return html;
};
const listEmptyDesktop = () =>
  withPrefix(
    'L',
    () =>
      `${rail('spaces')}<div class="workspace">${canopy('Spaces', 'A bed for a trip, a meal, a later mood.')}<div class="content">${emptyBed('No beds yet.', 'Save first if you want. A Space can wait.', 'New Space')}${shadcn('Empty · Dialog')}</div></div>`,
  );
const listEmptyPhone = () =>
  withPrefix(
    'L',
    () =>
      `${mobileTop('Spaces')}${canopy('Spaces', 'Start one when you need it.')}<div class="content">${emptyBed('No beds yet.', 'The library still holds every original.', 'New Space')}</div>`,
  );
const listFullDesktop = () =>
  withPrefix(
    'L',
    () =>
      `${rail('spaces')}<div class="workspace">${canopy('Spaces', 'Same originals. Different beds.')}<div class="content"><div class="heading"><h3>${number()}Your beds</h3>${button('New Space', 'primary')}</div><div class="beds">${bed('Things to cook', '4', 'moss')}${bed('Places to visit', '2', 'sand')}${bed('Friday notes', '1', 'sage')}</div>${shadcn('Badge · Button · Dialog')}</div></div>`,
  );
const listFullPhone = () =>
  withPrefix(
    'L',
    () =>
      `${mobileTop('Spaces')}${canopy('Your beds', 'Open one.')}<div class="content"><div class="beds">${bed('Things to cook', '4', 'moss')}${bed('Places to visit', '2', 'sand')}</div>${button('New Space', 'primary')}</div>`,
  );
const viewDesktop = () =>
  withPrefix(
    'V',
    () =>
      `${rail('spaces')}<div class="workspace">${canopy('Things to cook', 'Membership only. The original stays one.')}<div class="content"><div class="heading"><h3>${number()}Things to cook</h3><div>${button('Rename')}${button('Delete Space')}</div></div>${p('This card also sits in Places to visit. One original.', 'muted')}<div class="card-grid">${card()}${card(true)}</div>${shadcn('Button · Sheet · Dialog')}</div></div>`,
  );
const viewPhone = () =>
  withPrefix(
    'V',
    () =>
      `${mobileTop('Space')}${canopy('Things to cook', 'One original.')}<div class="content">${card()}${p('Actions open in a Sheet.', 'muted')}</div>`,
  );
const captureUnset = () =>
  withPrefix(
    'C',
    () =>
      `${rail('library')}<div class="workspace">${canopy('New card', 'Save without a Space.')}<div class="content"><section class="composer"><div class="composer-heading"><h4>${number()}New card</h4></div><label>${number()}Original input<textarea class="original-field" readonly dir="auto" rows="4">${original}</textarea></label><label>${number()}Saving intent<textarea readonly rows="2">Keep for a quiet Friday.</textarea></label><label class="picker">${number()}Space · optional<input readonly value="" placeholder="None"></label>${p('Empty is valid. Capture still saves.', 'muted')}${button('Save original', 'primary')}${shadcn('Combobox · Field')}</section></div></div>`,
  );
const captureChosen = () =>
  withPrefix(
    'C',
    () =>
      `${rail('library')}<div class="workspace">${canopy('New card', 'Attach after the receipt.')}<div class="content"><section class="composer"><div class="composer-heading"><h4>${number()}New card</h4></div><label>${number()}Original input<textarea class="original-field" readonly dir="auto" rows="3">${original}</textarea></label><label class="picker">${number()}Space · optional<div class="chip-row"><span class="chip">${number()}Things to cook</span></div></label>${p('If attach fails, the item is still saved. Retry add.', 'muted')}${button('Save original', 'primary')}${shadcn('Combobox · Field · Button')}</section></div></div>`,
  );
const captureUnsetPhone = () =>
  withPrefix(
    'C',
    () =>
      `${mobileTop('New card')}<div class="content"><section class="composer"><h4>${number()}New card</h4><label>${number()}Original<input readonly dir="auto" class="original-field" value="קפה קטן בגינה 🍋 שלום é"></label><label class="picker">${number()}Space<input readonly placeholder="None"></label>${button('Save original', 'primary')}</section></div>`,
  );
const captureChosenPhone = () =>
  withPrefix(
    'C',
    () =>
      `${mobileTop('New card')}<div class="content"><section class="composer"><h4>${number()}Chosen Space</h4><div class="chip-row"><span class="chip">${number()}Things to cook</span></div>${button('Save original', 'primary')}</section></div>`,
  );
const captureUnconfirmed = () =>
  withPrefix(
    'C',
    () =>
      `${rail('library')}<div class="workspace">${canopy('Saved. Not attached yet.', 'The original is safe in Library.')}<div class="content"><section class="composer"><h4>${number()}New card</h4><div class="status unconfirmed">Unconfirmed attach</div><p class="muted">We could not confirm Things to cook. The save remains.</p><div class="original-preview original-field" dir="auto">${original.split('\n')[0]}</div>${button('Retry adding to Space', 'primary')}${p('Retry adds this saved item. It does not save again.', 'muted')}${shadcn('Badge · Button')}</section></div></div>`,
  );
const captureUnconfirmedPhone = () =>
  withPrefix(
    'C',
    () =>
      `${mobileTop('New card')}<div class="content"><section class="composer"><h4>${number()}Saved. Not attached.</h4><div class="status unconfirmed">Unconfirmed attach</div><p class="muted">Original stays in Library.</p>${button('Retry adding to Space', 'primary')}</section></div>`,
  );
const membershipDesktop = () =>
  withPrefix(
    'K',
    () =>
      `${rail('spaces')}<div class="workspace">${canopy('Move with the keyboard', 'Visible buttons. No hover-only path.')}<div class="content">${card(true, true)}${p('Command lists Spaces for Move.', 'component-line')}${shadcn('Command · Button')}</div></div>`,
  );
const membershipPhone = () =>
  withPrefix(
    'K',
    () =>
      `${mobileTop('Move')}<div class="content"><div class="sheet"><h4>${number()}Move to</h4>${p('Places to visit', 'sheet-item')}${p('Friday notes', 'sheet-item')}${button('Cancel')}</div></div>`,
  );
const emptySpaceDesktop = () =>
  withPrefix(
    'E',
    () =>
      `${rail('spaces')}<div class="workspace">${canopy('Places to visit', 'Nothing in this Space.')}<div class="content">${emptyBed('This bed is empty.', 'The originals are still in Library.', 'Back to Library')}${p('Removing membership never deletes a save.', 'muted')}</div></div>`,
  );
const emptySpacePhone = () =>
  withPrefix(
    'E',
    () =>
      `${mobileTop('Space')}${emptyBed('Empty bed.', 'Library still has the originals.', 'Library')}`,
  );
const deleteDesktop = () =>
  withPrefix(
    'D',
    () =>
      `${rail('spaces')}<div class="workspace"><div class="content"><div class="dialog"><h4>${number()}Delete this Space?</h4>${p('Items stay in the library. Only the bed goes.', 'muted')}<div class="dialog-actions">${button('Cancel')}${button('Delete Space', 'danger')}</div>${shadcn('AlertDialog')}</div></div></div>`,
  );
const deletePhone = () =>
  withPrefix(
    'D',
    () =>
      `${mobileTop('Delete')}<div class="content"><div class="dialog"><h4>${number()}Delete this Space?</h4>${p('Items stay.', 'muted')}${button('Cancel')}${button('Delete Space', 'danger')}</div></div>`,
  );

prefix = 'I';
const intro = `<header class="cover"><div class="cover-top">${p('sprout / design review')}${p('Issue #8 · 25 October 2026')}</div><h1>${number()}A bed for what you keep.<br>Never a second original.</h1>${p('Conservatory Spaces. Optional at capture. Remove the bed, keep the plant.', 'cover-description')}<div class="cover-bottom">${p('Static review sheet · awaiting Ohad markup')}${p('Inter only · synthetic screens')}</div></header><section class="readme">${p('How to review: every control group has an ID. Write "V04: quieter delete" or "C02: keep None." Controls are disabled. Saved items shown here are synthetic.')}${p('Hebrew, emoji and a combining accent stay original text. Quoted "Remind me Friday" is kept and Not scheduled.', 'muted')}</section>`;

prefix = 'M';
const motion = `<section class="motion-section" id="motion"><h2>${number()}Motion has a job.</h2>${p('Open to replay a 220 ms panel reveal of an already-open Space. This is not a timed success.')}<details class="motion-demo"><summary>${number()}Replay Space panel</summary><div class="motion-scene">${card(false)}</div></details>${p('Reduced motion removes travel. Status never waits on animation.', 'muted')}</section>`;

prefix = 'R';
const review = `<footer class="review"><h2>${number()}Your red pen decides.</h2>${p('Mark IDs. Schema and RLS approval is separate from this sheet.')}<div class="review-grid">${p('Keep / ______________________________________')}${p('Change / ____________________________________')}${p('Missing / ___________________________________')}</div>${p('Keyboard: visible focus, 44px targets, labels on every field. Light for daytime desktop. Dark for evening phone.', 'muted')}</footer>`;

prefix = 'S';
const sections = `
<section class="direction" id="spaces-list"><h2>${number()}Spaces list</h2>${p('Uneven beds in the same greenhouse. Empty first.')}${pair('list-empty', 'Spaces list · empty', listEmptyDesktop, listEmptyPhone)}${pair('list-full', 'Spaces list · populated', listFullDesktop, listFullPhone)}</section>
<section class="direction" id="space-view"><h2>${number()}Space view</h2>${p('Cards reuse the library original. Add, Move, and Remove stay visible.')}${pair('view', 'Space view', viewDesktop, viewPhone)}</section>
<section class="direction" id="capture"><h2>${number()}Pick a Space during capture</h2>${p('Combobox under intent. None is a real choice.')}${pair('capture-none', 'Capture · no Space', captureUnset, captureUnsetPhone)}${pair('capture-one', 'Capture · one Space', captureChosen, captureChosenPhone)}${pair('capture-unconfirmed', 'Capture · unconfirmed attach', captureUnconfirmed, captureUnconfirmedPhone)}</section>
<section class="direction" id="membership"><h2>${number()}Add, move, remove</h2>${p('Touch and keyboard use the same three buttons.')}${pair('membership', 'Membership actions', membershipDesktop, membershipPhone)}</section>
<section class="direction" id="empty-delete"><h2>${number()}Empty and delete</h2>${p('An empty Space is not a deleted library.')}${pair('empty-space', 'Empty Space', emptySpaceDesktop, emptySpacePhone)}${pair('delete-space', 'Delete Space', deleteDesktop, deletePhone)}</section>
<section class="direction" id="components"><h2>${number()}Named pieces</h2>${p('A shared component vocabulary for this proposal.')}${shadcn('Button · Textarea · Field · Input · Label · Dialog · AlertDialog · Command · Combobox · Sheet · Empty · Badge')}</section>
`;

const css = `
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
*{box-sizing:border-box}html,body{margin:0;max-width:100%}body{background:#f1f4ee;color:#20382b;font:15px/1.55 Inter,sans-serif}button,input,textarea{font:inherit}h1,h2,h3,h4,p{margin:0}h1,h2,h3,h4{line-height:1.15;letter-spacing:-.03em}h2{font-size:32px}h3{font-size:28px}h4{font-size:22px}p{margin:10px 0}::selection{background:#bdd7b4;color:#183c2b}
.pen{display:inline-block;vertical-align:middle;font:600 11px/1.5 Inter,sans-serif;color:#913e3c;background:#fff0e9;border:1px solid #d4aaa0;border-radius:4px;padding:0 4px;margin-right:7px}
.cover{background:#1f3a2c;color:#f4f7ed;padding:32px max(24px,calc((100% - 1240px)/2)) 44px}
.cover-top,.cover-bottom{display:flex;justify-content:space-between;gap:16px;font-size:13px;color:#cedcc9}
.cover h1{font-size:clamp(34px,5vw,68px);font-weight:520;margin:36px 0 20px;max-width:1100px}
.cover-description{max-width:720px;font-size:20px;color:#d5e3cf}
.cover-bottom{border-top:1px solid #52705b;margin-top:36px;padding-top:16px}
.readme,.direction,.motion-section,.review{max-width:1240px;margin:32px auto;padding:0 20px}
.readme{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.muted{color:var(--sub,#53675a)}
.direction{margin-top:64px}
.specimen{margin:20px 0;min-width:0}
.spec-caption{display:flex;gap:8px;font-size:12px;color:#4e6255;margin:0 0 8px}
.spec-caption>span:last-child{margin-left:auto}
.screen{--bg:#f5f7f2;--fg:#1e3026;--sub:#526258;--line:#c8d4c8;--card:#fffefa;--sage:#e8eee5;--primary:#315b42;--on:#fff;background:var(--bg);color:var(--fg);border-radius:18px;overflow:hidden;box-shadow:0 18px 45px -24px #17351e5c;min-width:0}
.dark{--bg:#14231b;--fg:#eaf1e5;--sub:#b4c6b3;--line:#455c49;--card:#20352a;--sage:#2a4432;--primary:#b6d7a4;--on:#173020}
.desktop{display:flex;min-height:560px}
.rail{width:168px;flex:none;padding:26px 16px;background:#203c2d;color:#e7f0e0;display:flex;flex-direction:column}
.dark .rail{background:#0e1c14}
.wordmark{display:flex;align-items:center;font-size:22px;font-weight:650;letter-spacing:-.04em}
.sprout-symbol{width:24px;height:24px;margin-right:6px}
.rail nav{margin-top:36px}
.rail nav p{padding:12px 10px;margin:6px 0;color:#ccdcc7}
.selected{background:#d5e5c9;color:#203c2d;border-radius:8px;font-weight:600}
.rail nav p.selected{color:#203c2d}
.rail-bottom{margin-top:auto}
.workspace{flex:1;min-width:0}
.canopy{position:relative;isolation:isolate;min-height:220px;background:#2c5039;color:#f1f6e9;overflow:hidden}
.canopy-copy{position:relative;z-index:1;padding:32px 32px 56px;max-width:560px}
.canopy h3{font-size:42px;font-weight:540;letter-spacing:-.03em}
.canopy-description{color:#d8e7cf;font-size:14px;max-width:320px}
.greenhouse-art{position:absolute;inset:0 0 0 38%;opacity:.85}
.arch{position:absolute;width:180px;height:300px;border:1px solid #c4d6a888;border-radius:110px 110px 0 0;bottom:-70px;transform:rotate(22deg);background:linear-gradient(125deg,#b1c79622,#426b3f00)}
.arch-one{right:-8px;width:200px}.arch-two{right:118px}.arch-three{right:248px;bottom:-120px}
.glass-shelf{position:absolute;right:36px;bottom:28px;display:flex;align-items:end;gap:12px;transform:rotate(-12deg)}
.glass-shelf i{display:block;width:72px;height:90px;background:#8cab7770;border-radius:10px;box-shadow:0 16px 24px #0e2b2733}
.glass-shelf i:nth-child(2){height:130px;background:#bed2a655}
.glass-shelf i:nth-child(3){height:70px;background:#b8b18d70}
.content{padding:24px;min-width:0}
.heading{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:18px}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:8px 14px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);font-weight:550;margin:6px 6px 6px 0}
.button.primary{background:var(--primary);color:var(--on);border-color:var(--primary)}
.button.danger{background:#a8321f;color:#fff;border-color:#a8321f}
.button:focus-visible,input:focus-visible,textarea:focus-visible,.is-focus{outline:2px solid var(--primary);outline-offset:3px}
.beds{display:grid;grid-template-columns:1.15fr .85fr;gap:18px;align-items:start}
.bed{background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 18px 36px -18px #142c2577;min-width:0}
.bed.moss{transform:rotate(-.6deg)}
.bed.sand{background:#e9e1ca;color:#3f452c;transform:rotate(.7deg);margin-top:28px}
.bed.sage{grid-column:1}
.bed-art{height:104px;background:#dbe6cf;display:flex;align-items:end;padding:16px 20px;font-size:11px;position:relative;overflow:hidden}
.bed-art:after{content:'';position:absolute;right:36px;top:-28px;width:120px;height:150px;border:1px solid #8fa67c;border-radius:90px 90px 0 0;transform:rotate(28deg);opacity:.55}
.bed.sand .bed-art{background:#e2d7b5}
.dark .bed-art{background:#334f38;color:#d2e4bd}
.dark .bed.sand{background:#3d3a2a;color:#efe6c8}
.bed-copy{padding:18px 20px 22px}
.bed-excerpt{font-size:22px;line-height:1.3;margin:10px 0 14px}
.badge,.chip{display:inline-flex;align-items:center;background:var(--sage);border-radius:6px;padding:3px 8px;font-size:12px;font-weight:600}
.status{display:inline-flex;align-items:center;min-height:32px;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:650}.unconfirmed{background:#f1e5c9;color:#63491b}.dark .unconfirmed{background:#51432a;color:#f0dfb5}
.saved-card{background:var(--card);border-radius:14px;overflow:hidden;box-shadow:0 16px 32px -18px #142c2570;margin:0 0 18px}
.card-art{height:104px;background:#dbe6cf;display:flex;align-items:end;padding:16px 20px;font-size:11px;position:relative;overflow:hidden}
.card-art:after{content:'';position:absolute;right:42px;top:-30px;width:120px;height:150px;border:1px solid #8fa67c;border-radius:90px 90px 0 0;transform:rotate(28deg);opacity:.5}
.dark .card-art{background:#334f38;color:#d2e4bd}
.card-copy{padding:20px}
.original-preview{font-size:24px;margin:18px 0 12px}
.card-actions{display:flex;flex-wrap:wrap;align-items:center;gap:4px}
.empty{background:var(--sage);border-radius:14px;padding:36px 24px;text-align:center;box-shadow:inset 0 1px 0 #ffffff55}
.empty-title{font-size:22px;font-weight:600}
.seed{height:30px;width:14px;border-radius:14px 0;background:var(--primary);transform:rotate(25deg);margin:0 auto 16px}
.composer{background:var(--card);background-image:radial-gradient(#68835c0c .7px,transparent .7px);background-size:4px 4px;border-radius:14px;padding:24px;box-shadow:0 22px 50px -23px #102c2470;margin-top:-36px;position:relative;z-index:2}
.composer label{display:block;font-size:13px;font-weight:600;margin:14px 0}
textarea,input{display:block;width:100%;max-width:100%;padding:12px;margin-top:8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
.chip-row{margin-top:8px}
.component-line,.kbd-note{font-size:12px}
.shadcn{margin:8px 0 0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)}
.phone .greenhouse-art{left:55%}
.phone .canopy{min-height:168px}
.phone .canopy-copy{padding:24px 18px 40px}
.phone .canopy h3{font-size:30px}
.phone .glass-shelf,.phone .arch-three{display:none}
.phone .composer{margin-top:-28px;padding:20px 16px}
.dialog,.sheet{background:var(--card);border-radius:14px;padding:24px;box-shadow:0 22px 50px -23px #102c2470;max-width:420px}
.dialog-actions{margin-top:12px}
.sheet-item{padding:12px 0;border-bottom:1px solid var(--line);min-height:44px}
.phones{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.phone{width:100%;max-width:420px;min-height:640px;border-radius:22px;border:5px solid var(--line);justify-self:center}
.mobile-top{display:flex;align-items:center;gap:6px;background:#203c2d;color:#eef5e8;padding:14px 16px;font-weight:600}
.mobile-top span:last-child{margin-left:auto;font-size:12px}
.motion-demo{margin-top:16px;background:#e3eadf;padding:16px;border-radius:12px;max-width:640px}
.motion-demo summary{min-height:44px;cursor:pointer;font-weight:600}
.motion-scene{margin-top:12px;background:#fffefa;border-radius:10px;padding:8px}
.motion-demo[open] .motion-scene{animation:panel-reveal 220ms cubic-bezier(.16,1,.3,1) both}
@keyframes panel-reveal{from{opacity:.7;transform:translateY(12px)}to{opacity:1;transform:none}}
.review{border-top:1px solid #b8cbb3;padding:30px 20px 50px}
.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.review-grid p{border-bottom:1px solid #c3d0bc;padding:14px 0}
@media(hover:hover) and (prefers-reduced-motion:no-preference){.bed:hover,.saved-card:hover{transform:translateY(-3px);box-shadow:0 16px 28px -16px #1e3c2b66}.bed,.saved-card{transition:transform 160ms cubic-bezier(.16,1,.3,1),box-shadow 160ms}}
@media(max-width:850px){.readme,.phones,.beds,.review-grid{grid-template-columns:1fr}.desktop .rail{display:none}.canopy h3{font-size:28px}}
@media(max-width:540px){.cover,.readme,.direction,.motion-section,.review{padding-left:14px;padding-right:14px}.cover h1{font-size:36px}.desktop{display:block}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

await writeFile(
  new URL('../../design/issue-8-review.html', import.meta.url),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sprout #8 — Spaces red-pen review</title><style>${css}</style></head><body>${intro}${sections}${motion}${review}</body></html>\n`,
);
console.log(
  `Built review sheet with ${Object.values(counts).reduce((sum, count) => sum + count, 0)} numbered groups.`,
);
