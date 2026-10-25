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
const originalLine = original.split('\n')[0];
const shadcn = (name) => `<p class="shadcn">${name}</p>`;
const moreIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>`;
const plusIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;

const spaces = [
  {
    key: 'cook',
    name: 'Things to cook',
    count: '4',
    icon: 'circle',
    tiles: [
      { kind: 'text', text: originalLine, field: true },
      { kind: 'image', tone: 'citrus' },
      { kind: 'text', text: 'Citrus tahini on warm bread.' },
      { kind: 'link', text: 'Carmel market hours' },
    ],
  },
  {
    key: 'visit',
    name: 'Places to visit',
    count: '2',
    icon: 'diamond',
    tiles: [
      { kind: 'image', tone: 'walk' },
      { kind: 'text', text: originalLine, field: true },
      { kind: 'text', text: 'Quiet street near the port.' },
    ],
  },
  {
    key: 'notes',
    name: 'Friday notes',
    count: '1',
    icon: 'square',
    tiles: [{ kind: 'text', text: '"Remind me Friday"', field: true }],
  },
];

const tile = (item) => {
  const field = item.field ? ' original-field' : '';
  if (item.kind === 'image')
    return `<div class="tile image ${item.tone}" aria-hidden="true"><i></i></div>`;
  if (item.kind === 'link')
    return `<div class="tile link"><span>Link</span><b>${item.text}</b></div>`;
  return `<div class="tile text${field}" dir="auto">${item.text}</div>`;
};

const mosaic = (space, count = 4) =>
  `<div class="mosaic count-${Math.min(count, space.tiles.length)}">${space.tiles
    .slice(0, count)
    .map(tile)
    .join('')}</div>`;

const spaceIcon = (icon) =>
  `<span class="space-icon ${icon}" aria-hidden="true"></span>`;

const rail = (selected, current = 'cook', live = true) => {
  const rows = live
    ? spaces
        .map(
          (space) =>
            `<a class="space-row${space.key === current && selected === 'spaces' ? ' is-current' : ''}" data-space="${space.key}"><span class="dot ${space.key}"></span><span>${number()}${space.name}</span><span class="count">${space.count}</span></a>`,
        )
        .join('')
    : '';
  return `<aside class="rail"><div class="wordmark">${number()}sprout</div><nav class="nav">${p('Library', selected === 'library' ? 'selected' : '')}${p('Ask', selected === 'ask' ? 'selected' : '')}<div class="nav-spaces"><p class="${selected === 'spaces' ? 'selected' : ''}">${number()}Spaces</p>${rows}</div>${p('Settings')}</nav><div class="rail-foot"><kbd>⌘K</kbd>${p('Ask')}</div></aside>`;
};

const mobileTop = (label) =>
  `<div class="mobile-top">${number()}sprout<span>${label}</span></div>`;

const header = (title, line, space = '', action = 'New space') =>
  `<header class="app-header${space ? ` space-${space}` : ''}"><div class="header-copy"><h3>${number()}${title}</h3>${p(line, 'header-line')}</div><div class="header-ask">${number()}<span>Ask</span><kbd>⌘K</kbd></div>${button(action, 'primary')}</header>`;

const spaceCard = (space, tilt = true) =>
  `<article class="space-card ${space.key}"${tilt ? ' data-tilt="true"' : ''} style="--space:var(--${space.key})">${mosaic(space)}<div class="space-meta">${spaceIcon(space.icon)}<div><h4>${number()}${space.name}</h4></div><span class="count">${number()}${space.count}</span></div></article>`;

const ghost = () =>
  `<article class="space-card ghost" aria-hidden="true"><div class="mosaic count-4"><i></i><i></i><i></i><i></i></div><div class="space-meta"><span class="space-icon circle"></span><div><b></b></div></div></article>`;

const menu = (open = true) =>
  `<div class="more-wrap${open ? ' is-open' : ''}"><button disabled class="more" aria-label="Item actions">${number()}${moreIcon}</button>${
    open
      ? `<div class="menu glass"><button disabled>${number()}Add<span>A</span></button><button disabled>${number()}Move<span>M</span></button><button disabled class="danger">${number()}Remove<span>⌫</span></button></div>`
      : ''
  }</div>`;

const chips = (keys, fly = false) =>
  `<div class="chips">${keys
    .map((key) => {
      const space = spaces.find((item) => item.key === key);
      return `<span class="chip ${key}${fly && key === 'visit' ? ' is-flying' : ''}"><i></i>${number()}${space.name}</span>`;
    })
    .join('')}</div>`;

const savedCard = (opts = {}) => {
  const {
    actions = true,
    phone = false,
    openMenu = false,
    focus = false,
    extra = ['cook', 'visit'],
    fly = false,
  } = opts;
  return `<article class="saved-card${focus ? ' is-focus' : ''}"><div class="card-top">${chips(extra, fly)}<time>Today</time>${
    actions
      ? phone
        ? `<button disabled class="more" aria-label="Open actions">${number()}${moreIcon}</button>`
        : menu(openMenu)
      : ''
  }</div><div class="original-preview original-field" dir="auto">${number()}${originalLine}</div>${p('Keep for a quiet Friday.', 'muted')}</article>`;
};

const starter = () =>
  `<div class="starters">${spaces.map((space) => `<button disabled class="starter ${space.key}"><i></i>${number()}${space.name}</button>`).join('')}</div>`;

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
      `${rail('spaces', 'cook', false)}<div class="workspace">${header('Spaces', 'Start when you need one.')}<div class="content"><div class="ghosts">${ghost()}${ghost()}${ghost()}</div><div class="empty-actions">${button('New space', 'primary')}${starter()}</div>${shadcn('Empty · Dialog · Badge')}</div></div>`,
  );
const listEmptyPhone = () =>
  withPrefix(
    'L',
    () =>
      `${mobileTop('Spaces')}${header('Spaces', 'Start when you need one.')}<div class="content"><div class="ghosts">${ghost()}${ghost()}${ghost()}</div>${button('New space', 'primary')}${starter()}</div>`,
  );
const listFullDesktop = () =>
  withPrefix(
    'L',
    () =>
      `${rail('spaces')}<div class="workspace">${header('Spaces', '12 items')}<div class="content"><div class="bento stagger">${spaces.map((space) => spaceCard(space)).join('')}</div>${shadcn('Badge · Button · Dialog')}</div></div>`,
  );
const listFullPhone = () =>
  withPrefix(
    'L',
    () =>
      `${mobileTop('Spaces')}${header('Spaces', '12 items')}<div class="content"><div class="bento stagger">${spaces.map((space) => spaceCard(space, false)).join('')}</div>${button('New space', 'primary')}</div>`,
  );
const viewDesktop = () =>
  withPrefix(
    'V',
    () =>
      `${rail('spaces', 'cook')}<div class="workspace">${header('Things to cook', '4 items', 'cook', 'Rename')}<div class="content"><div class="card-grid">${savedCard({ openMenu: true })}${savedCard({ extra: ['cook'] })}</div>${shadcn('DropdownMenu · Badge · Sheet')}</div></div>`,
  );
const viewPhone = () =>
  withPrefix(
    'V',
    () =>
      `${mobileTop('Space')}${header('Things to cook', '4 items', 'cook', 'Rename')}<div class="content">${savedCard({ phone: true, extra: ['cook', 'visit'] })}${p('One icon opens a Sheet.', 'muted')}</div>`,
  );
const captureUnset = () =>
  withPrefix(
    'C',
    () =>
      `${rail('library')}<div class="workspace">${header('New card', 'Space is optional.')}<div class="content"><section class="composer"><label>${number()}Original input<textarea class="original-field" readonly dir="auto" rows="4">${original}</textarea></label><label>${number()}Saving intent<textarea readonly rows="2">Keep for a quiet Friday.</textarea></label><div class="picker"><span>${number()}Space · optional</span><div class="recent">${spaces.map((space) => `<button disabled class="chip ${space.key}"><i></i>${number()}${space.name}</button>`).join('')}<button disabled class="plus" aria-label="More spaces">${number()}${plusIcon}</button></div></div>${p('Empty is valid. Capture still saves.', 'muted')}${shadcn('Combobox · Field')}</section></div></div>`,
  );
const captureChosen = () =>
  withPrefix(
    'C',
    () =>
      `${rail('library')}<div class="workspace">${header('New card', 'Attach after the receipt.', 'cook', 'Save original')}<div class="content"><section class="composer tint-cook"><label>${number()}Original input<textarea class="original-field" readonly dir="auto" rows="3">${original}</textarea></label><div class="picker"><span>${number()}Space · optional</span><div class="recent"><span class="chip cook is-on"><i></i>${number()}Things to cook</span><button disabled class="plus" aria-label="More spaces">${number()}${plusIcon}</button></div></div>${p('If attach fails, the item is still saved. Retry add.', 'muted')}${shadcn('Combobox · Field · Button')}</section></div></div>`,
  );
const captureUnsetPhone = () =>
  withPrefix(
    'C',
    () =>
      `${mobileTop('New card')}<div class="content"><section class="composer"><h4>${number()}New card</h4><label>${number()}Original<input readonly dir="auto" class="original-field" value="קפה קטן בגינה 🍋 שלום é"></label><div class="recent">${spaces.map((space) => `<button disabled class="chip ${space.key}"><i></i>${space.name}</button>`).join('')}${button('+', 'plus')}</div>${button('Save original', 'primary')}</section></div>`,
  );
const captureChosenPhone = () =>
  withPrefix(
    'C',
    () =>
      `${mobileTop('New card')}<div class="content"><section class="composer tint-cook"><h4>${number()}New card</h4><div class="recent"><span class="chip cook is-on"><i></i>${number()}Things to cook</span>${button('+', 'plus')}</div>${button('Save original', 'primary')}</section></div>`,
  );
const captureUnconfirmed = () =>
  withPrefix(
    'C',
    () =>
      `${rail('library')}<div class="workspace">${header('Saved. Not attached yet.', 'The original is in Library.')}<div class="content"><section class="composer"><h4>${number()}New card</h4><div class="status unconfirmed">Unconfirmed attach</div>${p('We could not confirm Things to cook. The save remains.', 'muted')}<div class="original-preview original-field" dir="auto">${originalLine}</div>${button('Retry adding to Space', 'primary')}${p('Retry adds this saved item. It does not save again.', 'muted')}${shadcn('Badge · Button')}</section></div></div>`,
  );
const captureUnconfirmedPhone = () =>
  withPrefix(
    'C',
    () =>
      `${mobileTop('New card')}<div class="content"><section class="composer"><h4>${number()}Saved. Not attached.</h4><div class="status unconfirmed">Unconfirmed attach</div>${p('Original stays in Library.', 'muted')}${button('Retry adding to Space', 'primary')}</section></div>`,
  );
const membershipDesktop = () =>
  withPrefix(
    'K',
    () =>
      `${rail('spaces', 'cook')}<div class="workspace">${header('Things to cook', '4 items', 'cook')}<div class="content">${savedCard({ openMenu: true, focus: true, fly: true })}<div class="command glass"><div class="command-input">${number()}Move to…</div><div class="command-item"><span class="dot visit"></span>${number()}Places to visit<span>2</span></div><div class="command-item"><span class="dot notes"></span>${number()}Friday notes<span>1</span></div></div>${p('Command lists Spaces for Move. ⌘K itself does not animate.', 'component-line')}${shadcn('Command · DropdownMenu')}</div></div>`,
  );
const membershipPhone = () =>
  withPrefix(
    'K',
    () =>
      `${mobileTop('Move')}<div class="content"><div class="sheet glass"><h4>${number()}Move to</h4><div class="sheet-item"><span class="dot visit"></span>${p('Places to visit')}</div><div class="sheet-item"><span class="dot notes"></span>${p('Friday notes')}</div>${button('Cancel')}</div></div>`,
  );
const emptySpaceDesktop = () =>
  withPrefix(
    'E',
    () =>
      `${rail('spaces', 'visit')}<div class="workspace">${header('Places to visit', 'Nothing in this Space.', 'visit')}<div class="content"><div class="ghosts">${ghost()}${ghost()}${ghost()}</div>${p('Removing membership never deletes a save.', 'muted')}</div></div>`,
  );
const emptySpacePhone = () =>
  withPrefix(
    'E',
    () =>
      `${mobileTop('Space')}${header('Places to visit', 'Empty.', 'visit')}<div class="content"><div class="ghosts">${ghost()}${ghost()}</div>${p('Library still has the originals.', 'muted')}</div>`,
  );
const libraryTiles = () =>
  `<div class="keep-tiles">${tile(spaces[0].tiles[0])}${tile(spaces[0].tiles[1])}${tile(spaces[1].tiles[0])}${tile(spaces[2].tiles[0])}</div>`;
const deleteDesktop = () =>
  withPrefix(
    'D',
    () =>
      `${rail('spaces')}<div class="workspace"><div class="content"><div class="dialog glass"><h4>${number()}Delete this Space?</h4>${p('Items stay in the library. Only the Space goes.', 'muted')}${libraryTiles()}<div class="dialog-actions">${button('Cancel')}${button('Delete Space', 'danger')}</div>${shadcn('AlertDialog')}</div></div></div>`,
  );
const deletePhone = () =>
  withPrefix(
    'D',
    () =>
      `${mobileTop('Delete')}<div class="content"><div class="dialog glass"><h4>${number()}Delete this Space?</h4>${p('Items stay in the library.', 'muted')}${libraryTiles()}${button('Cancel')}${button('Delete Space', 'danger')}</div></div>`,
  );

prefix = 'I';
const intro = `<header class="cover"><div class="cover-top">${p('sprout / design review')}${p('Issue #8 · round 2 · 25 October 2026')}</div><h1>${number()}Spaces.<br>Same originals.</h1>${p('Bright greenhouse accents on paper. Markup the IDs.', 'cover-description')}<div class="type-toggle">${p('Type default is Inter.')}<button type="button" data-type="inter">${number()}Inter only</button><button type="button" data-type="display">${number()}Optional Iowan pairing</button></div><div class="cover-bottom">${p('Static review sheet · awaiting Ohad markup')}${p('Inter default · synthetic screens')}</div></header><section class="readme">${p('How to review: every control group has an ID. Write "V04: quieter delete" or "C02: keep None." Product controls are disabled. Replay buttons run motion.')}${p('Hebrew, emoji and a combining accent stay original text. Quoted "Remind me Friday" is kept and Not scheduled.', 'muted')}</section>`;

prefix = 'M';
const motion = `<section class="motion-section" id="motion"><h2>${number()}Motion has a job.</h2>${p('Card grows into the Space page. Bento staggers. A chip flies to the sidebar on move. Hover tilts the card. All of it turns off under reduced motion. ⌘K does not animate.')}<div class="motion-grid"><div class="motion-demo"><div class="demo-head"><strong>${number()}layoutId grow</strong><button type="button" data-replay="grow-scene">Replay</button></div><div class="motion-scene" id="grow-scene"><article class="space-card cook grow-card">${mosaic(spaces[0])}<div class="space-meta">${spaceIcon('circle')}<div><h4>Things to cook</h4><span class="count">4</span></div></div></article><div class="grow-page">${header('Things to cook', '4 items', 'cook', 'Rename')}</div></div></div><div class="motion-demo"><div class="demo-head"><strong>${number()}Chip flies</strong><button type="button" data-replay="fly-scene">Replay</button></div><div class="motion-scene fly-scene" id="fly-scene"><aside class="mini-rail"><span class="dot visit"></span>Places to visit</aside>${savedCard({ extra: ['visit'], fly: true, actions: false })}</div></div></div>${p('Reduced motion removes travel. Status never waits on animation.', 'muted')}</section>`;

prefix = 'R';
const review = `<footer class="review"><h2>${number()}Your red pen decides.</h2>${p('Mark IDs. Schema and RLS approval is separate from this sheet.')}<div class="review-grid">${p('Keep / ______________________________________')}${p('Change / ____________________________________')}${p('Missing / ___________________________________')}</div>${p('Keyboard: visible focus, 44px targets, labels on every field. Light for daytime desktop. Dark for evening phone.', 'muted')}</footer>`;

prefix = 'S';
const sections = `
<section class="direction" id="spaces-list"><h2>${number()}Spaces list</h2>${p('Bento sized by count. Mosaics of real originals. Empty ghosts breathe.')}${pair('list-empty', 'Spaces list · empty', listEmptyDesktop, listEmptyPhone)}${pair('list-full', 'Spaces list · populated', listFullDesktop, listFullPhone)}</section>
<section class="direction" id="space-view"><h2>${number()}Space view</h2>${p('Chips on the card. One menu. Slim tinted header.')}${pair('view', 'Space view', viewDesktop, viewPhone)}</section>
<section class="direction" id="capture"><h2>${number()}Pick a Space during capture</h2>${p('Recent chips and a + Combobox. Edges tint after a choice.')}${pair('capture-none', 'Capture · no Space', captureUnset, captureUnsetPhone)}${pair('capture-one', 'Capture · one Space', captureChosen, captureChosenPhone)}${pair('capture-unconfirmed', 'Capture · unconfirmed attach', captureUnconfirmed, captureUnconfirmedPhone)}</section>
<section class="direction" id="membership"><h2>${number()}Add, move, remove</h2>${p('Desktop uses DropdownMenu. Phone uses one icon and a Sheet.')}${pair('membership', 'Membership actions', membershipDesktop, membershipPhone)}</section>
<section class="direction" id="empty-delete"><h2>${number()}Empty and delete</h2>${p('An empty Space is not a deleted library. Delete shows the tiles that stay.')}${pair('empty-space', 'Empty Space', emptySpaceDesktop, emptySpacePhone)}${pair('delete-space', 'Delete Space', deleteDesktop, deletePhone)}</section>
<section class="direction" id="components"><h2>${number()}Named pieces</h2>${p('Official shadcn only. Community kits stay pattern references.')}${shadcn('Button · Textarea · Field · Input · Label · Dialog · AlertDialog · Command · Combobox · Popover · DropdownMenu · Sheet · Empty · Badge')}<article class="specimen alt-spec" id="type-pairing"><div class="spec-caption">${number()}Optional display pairing<span>Inter stays default</span></div><div class="alt-card alt-type"><h3>Things to cook</h3><p>Iowan Old Style / Palatino for headings. Inter for everything else. Ohad picks.</p></div></article></section>
`;

const css = `
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
:root{--cook:#17a054;--visit:#e3a014;--notes:#1a88ad;--ease-out:cubic-bezier(.23,1,.32,1);--ease-move:cubic-bezier(.77,0,.175,1)}
*{box-sizing:border-box}
html,body{margin:0;max-width:100%}
body{background:#e8ece4;color:#142018;font:15px/1.5 Inter,system-ui,sans-serif;font-feature-settings:"tnum" 1,"ss01" 1;caret-color:#2c6a45}
body.alt-type h1,body.alt-type h2,body.alt-type .app-header h3,body.alt-type .cover h1,body.alt-type .alt-type h3{font-family:"Iowan Old Style","Palatino Linotype",Palatino,"Times New Roman",serif}
button,input,textarea{font:inherit}
h1,h2,h3,h4,p{margin:0}
h1,h2,h3,h4{line-height:1.06;letter-spacing:-.03em;font-weight:560}
h2{font-size:36px;margin:0 0 12px}
h3{font-size:26px}
h4{font-size:18px}
p{margin:8px 0}
::selection{background:#c5ddc0;color:#102016}
.pen{display:inline-block;vertical-align:middle;font:600 11px/1.4 Inter,sans-serif;color:#8a3d36;background:#fff3ec;border:1px solid #e0c2b8;border-radius:3px;padding:0 4px;margin-right:6px}
.cover{background:#1a2f24;color:#eef4ea;padding:28px max(24px,calc((100% - 1240px)/2)) 40px;position:relative;overflow:hidden}
.cover:before{content:"";position:absolute;inset:0;background:linear-gradient(108deg,#17a0542e,#e3a0141c 46%,#1a88ad26);background-size:220% 100%;animation:header-shift 16s var(--ease-move) infinite;pointer-events:none}
.cover-top,.cover-bottom,.type-toggle{position:relative;display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap}
.cover-top,.cover-bottom{font-size:13px;color:#c4d4c4}
.cover h1{position:relative;font-size:clamp(42px,6.2vw,76px);font-weight:520;margin:28px 0 14px;max-width:920px;letter-spacing:-.038em}
.cover-description{position:relative;max-width:560px;font-size:18px;color:#d4e2ce}
.type-toggle{position:relative;margin-top:22px}
.type-toggle button{min-height:44px;padding:0 14px;border:1px solid #3d5244;border-radius:10px;background:#15241c;color:#edf3e8}
.cover-bottom{border-top:1px solid #2d4236;margin-top:28px;padding-top:14px}
.readme,.direction,.motion-section,.review{max-width:1240px;margin:32px auto;padding:0 20px}
.readme{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.muted{color:var(--sub,#526258)}
.direction{margin-top:68px}
.specimen{margin:20px 0;min-width:0}
.spec-caption{display:flex;gap:8px;font-size:12px;color:#4a5c50;margin:0 0 8px}
.spec-caption>span:last-child{margin-left:auto}
.screen{--bg:#f5f7f2;--fg:#142018;--sub:#3f5348;--line:#cdd6cb;--card:#fcfdf9;--sage:#e7eee3;--primary:#2c6a45;--on:#fff;--rail:#eef1ea;--header:#f6f8f3d9;--danger:#9b1c14;background:var(--bg);color:var(--fg);border-radius:14px;overflow:hidden;box-shadow:0 24px 48px -28px #10241880;min-width:0;position:relative}
.screen:before{content:"";position:absolute;inset:0;pointer-events:none;opacity:.04;background-image:radial-gradient(#142018 .55px,transparent .55px);background-size:3px 3px;z-index:0}
.screen>*{position:relative;z-index:1}
.dark{--bg:#080c0a;--fg:#e6efe6;--sub:#b7c9bb;--line:#1c2a22;--card:#101714;--sage:#121a16;--primary:#3dcc78;--on:#07110b;--rail:#0b100e;--header:#101714d9;--danger:#ff9b8c}
.desktop{display:flex;min-height:640px}
.rail{width:228px;flex:none;padding:20px 12px;background:var(--rail);border-right:1px solid var(--line);display:flex;flex-direction:column}
.wordmark{font-size:18px;font-weight:650;letter-spacing:-.045em;padding:0 10px}
.nav{margin-top:26px;display:grid;gap:2px}
.nav>p,.space-row{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 10px;border-radius:10px;color:var(--sub);text-decoration:none}
.selected,.space-row.is-current{background:color-mix(in srgb,var(--primary) 11%,transparent);color:var(--fg);font-weight:600}
.nav-spaces{display:grid;gap:2px;margin:2px 0}
.space-row{font-size:13px}
.space-row .count{margin-left:auto;font-variant-numeric:tabular-nums;font-size:12px;color:var(--sub)}
.dot{width:8px;height:8px;border-radius:99px;flex:none}
.dot.cook,.chip.cook i,.starter.cook i{background:var(--cook)}
.dot.visit,.chip.visit i,.starter.visit i{background:var(--visit)}
.dot.notes,.chip.notes i,.starter.notes i{background:var(--notes)}
.rail-foot{margin-top:auto;display:flex;align-items:center;gap:8px;color:var(--sub);font-size:12px;padding:0 10px}
kbd{font:600 11px/1 Inter,sans-serif;border:1px solid var(--line);border-radius:6px;padding:4px 6px;background:var(--card)}
.workspace{flex:1;min-width:0;display:flex;flex-direction:column}
.app-header{height:64px;min-height:64px;display:flex;align-items:center;gap:16px;padding:0 22px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--space,var(--cook)) 12%,var(--header));background-image:linear-gradient(108deg,color-mix(in srgb,var(--space,var(--cook)) 36%,transparent),color-mix(in srgb,var(--space,var(--cook)) 8%,transparent) 48%,transparent);background-size:220% 100%;backdrop-filter:blur(18px) saturate(1.3);box-shadow:inset 0 1px 0 #ffffff80;animation:header-shift 16s var(--ease-move) infinite}
.dark .app-header{box-shadow:inset 0 1px 0 #ffffff14}
.space-cook{--space:var(--cook)}.space-visit{--space:var(--visit)}.space-notes{--space:var(--notes)}
.header-copy{min-width:0;flex:1}
.app-header h3{font-size:24px;letter-spacing:-.032em}
.header-line{margin:2px 0 0;font-size:12px;letter-spacing:.01em;color:var(--sub)}
.header-ask{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:10px;color:var(--sub);background:color-mix(in srgb,var(--card) 72%,transparent)}
.content{padding:22px;min-width:0}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:8px 14px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--fg);font-weight:560}
.button.primary{background:var(--primary);color:var(--on);border-color:var(--primary)}
.button.danger,.menu .danger{color:var(--danger)}
.button:focus-visible,input:focus-visible,textarea:focus-visible,.is-focus,.more:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
.bento{display:grid;grid-template-columns:1.38fr .92fr;grid-template-rows:auto auto;gap:16px}
.space-card.cook{grid-row:span 2}
.space-card{background:var(--card);border-radius:14px;overflow:hidden;min-width:0;transform-origin:center;box-shadow:0 20px 40px -26px #10241873,inset 0 1px 0 #ffffff8c}
.space-card.cook{box-shadow:0 18px 32px -18px #10241873,inset 0 1px 0 #ffffff8c}
.space-card.visit{box-shadow:0 18px 32px -18px #10241873,inset 0 1px 0 #ffffff8c}
.space-card.notes{box-shadow:0 18px 32px -18px #10241873,inset 0 1px 0 #ffffff8c}
.dark .space-card.cook,.dark .space-card.visit,.dark .space-card.notes{box-shadow:0 20px 36px -18px #000000a6,inset 0 1px 0 #ffffff14}
.mosaic{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:1px;min-height:168px;background:color-mix(in srgb,var(--fg) 8%,transparent)}
.mosaic.count-1{grid-template-columns:1fr;grid-template-rows:1fr;min-height:132px}
.mosaic.count-2,.mosaic.count-3{grid-template-rows:1fr 1fr}
.count-3 .tile:first-child{grid-row:span 2}
.space-card.cook .mosaic{min-height:328px}
.tile{min-width:0;overflow:hidden;display:flex;align-items:end}
.tile.text{background:#f1e6c8;color:#12180f;padding:14px;font-size:17px;line-height:1.32;letter-spacing:-.022em;font-weight:540}
.dark .tile.text{background:#1c261c;color:#e8f0e4}
.tile.link{background:#dce8a8;flex-direction:column;justify-content:end;gap:6px;padding:14px}
.dark .tile.link{background:#2a3c20;color:#e8f0e4}
.tile.link span{font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:650;color:var(--sub)}
.tile.link b{font-size:15px;font-weight:560;letter-spacing:-.02em}
.tile.image{position:relative}
.tile.image i{position:absolute;inset:0;opacity:.14;background-image:radial-gradient(#1a1810 .45px,transparent .55px);background-size:2px 2px}
.tile.image.citrus{background:radial-gradient(ellipse 70% 55% at 28% 18%,#ffe7a0 0%,#f0c14a 18%,transparent 42%),radial-gradient(ellipse 36% 28% at 62% 30%,#fff4c4aa 0%,transparent 46%),radial-gradient(ellipse 80% 58% at 82% 92%,#0a2214 0%,transparent 52%),linear-gradient(158deg,#c4922a 0%,#4a8a32 34%,#1c5a30 64%,#0c2216 100%)}
.tile.image.walk{background:radial-gradient(ellipse 70% 42% at 74% 12%,#f6d08a 0%,transparent 40%),radial-gradient(ellipse 50% 36% at 16% 78%,#071e28 0%,transparent 46%),linear-gradient(168deg,#3f7a90 0%,#256878 38%,#163840 74%,#08181c 100%)}
.space-meta{display:flex;align-items:center;gap:10px;padding:12px 14px}
.space-meta h4{font-size:16px;letter-spacing:-.022em}
.space-meta .count,.saved-card time{margin-left:auto;font-size:12px;font-variant-numeric:tabular-nums;color:var(--sub)}
.space-icon{width:8px;height:8px;flex:none;background:var(--space,var(--cook))}
.space-icon.circle{border-radius:99px}
.space-icon.diamond{transform:rotate(45deg);border-radius:1px}
.space-icon.square{border-radius:1px}
.space-card.visit .space-icon,.chip.visit i{--space:var(--visit)}
.space-card.notes .space-icon,.chip.notes i{--space:var(--notes)}
.ghosts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}
.ghost{opacity:.62}
.ghost .mosaic{min-height:124px}
.ghost .mosaic i{display:block;min-height:60px;background:#d5ddd0}
.ghost .mosaic i:nth-child(2){background:#e3eadc}
.ghost .mosaic i:nth-child(3){background:#c8d4c2}
.ghost .mosaic i:nth-child(4){background:#dce4d4}
.dark .ghost .mosaic i{background:#1c2820}
.dark .ghost .mosaic i:nth-child(2){background:#243228}
.dark .ghost .mosaic i:nth-child(3){background:#16201a}
.dark .ghost .mosaic i:nth-child(4){background:#1f2c22}
.ghost .space-meta b{display:block;height:8px;width:46%;border-radius:4px;background:var(--line)}
.empty-actions{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.starters{display:flex;flex-wrap:wrap;gap:8px}
.starter,.chip,.plus{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--fg);white-space:nowrap}
.starter i,.chip i{width:8px;height:8px;border-radius:99px;flex:none}
.chip.cook,.starter.cook{background:color-mix(in srgb,var(--cook) 10%,var(--card));border-color:color-mix(in srgb,var(--cook) 28%,var(--line))}
.chip.visit,.starter.visit{background:color-mix(in srgb,var(--visit) 12%,var(--card));border-color:color-mix(in srgb,var(--visit) 30%,var(--line))}
.chip.notes,.starter.notes{background:color-mix(in srgb,var(--notes) 10%,var(--card));border-color:color-mix(in srgb,var(--notes) 28%,var(--line))}
.chip.is-on{border-color:color-mix(in srgb,var(--cook) 55%,var(--line));background:color-mix(in srgb,var(--cook) 16%,var(--card))}
.plus{width:44px;padding:0;justify-content:center}
.plus svg{width:16px;height:16px}
.saved-card{background:var(--card);border-radius:14px;padding:16px 16px 18px;box-shadow:0 16px 32px -22px #10241873,inset 0 1px 0 #ffffff8a;margin:0 0 14px}
.card-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.original-preview{font-size:22px;margin:16px 0 10px;letter-spacing:-.022em}
.more{width:44px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--fg);display:grid;place-items:center}
.more svg{width:18px;height:18px;fill:currentColor}
.more-wrap{position:relative;margin-left:auto}
.menu,.command,.dialog,.sheet,.glass{background:color-mix(in srgb,var(--card) 78%,transparent);backdrop-filter:blur(18px) saturate(1.25);box-shadow:0 22px 50px -24px #10241880,inset 0 1px 0 #ffffff8c}
.menu{position:absolute;right:0;top:46px;width:220px;padding:6px;border-radius:12px;display:grid}
.menu button{display:flex;align-items:center;justify-content:space-between;min-height:44px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:var(--fg)}
.menu span{color:var(--sub);font-size:11px}
.command{margin-top:16px;border-radius:14px;padding:8px;max-width:420px}
.command-input{min-height:44px;display:flex;align-items:center;padding:0 12px;border-bottom:1px solid var(--line);color:var(--sub)}
.command-item{display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px}
.command-item span:last-child{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--sub)}
.composer{background:var(--card);border-radius:14px;padding:22px;box-shadow:0 22px 50px -24px #10241873,inset 0 1px 0 #ffffff8a}
.composer.tint-cook{box-shadow:inset 3px 0 0 var(--cook),0 0 0 1px color-mix(in srgb,var(--cook) 30%,var(--line)),0 22px 50px -24px #10241873,inset 0 1px 0 #ffffff8a}
.composer label{display:block;font-size:12px;font-weight:650;letter-spacing:.02em;margin:12px 0;color:var(--sub)}
textarea,input{display:block;width:100%;max-width:100%;padding:12px;margin-top:8px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg)}
.picker{margin:16px 0 8px}
.picker>span{font-size:12px;font-weight:650;letter-spacing:.02em;color:var(--sub)}
.recent{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.card-grid{display:grid;gap:14px}
.status{display:inline-flex;align-items:center;min-height:32px;padding:4px 10px;border-radius:8px;font-size:12px;font-weight:650}
.unconfirmed{background:#f1e5c9;color:#63491b}
.dark .unconfirmed{background:#51432a;color:#f0dfb5}
.dialog,.sheet{border-radius:14px;padding:22px;max-width:460px}
.dialog-actions{margin-top:14px;display:flex;gap:8px}
.sheet-item{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--line);min-height:44px}
.keep-tiles{display:grid;grid-template-columns:1fr 1fr;gap:1px;margin:14px 0;min-height:148px;border-radius:12px;overflow:hidden}
.keep-tiles .tile{min-height:72px}
.phones{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.phone{width:100%;max-width:420px;min-height:700px;border-radius:20px;border:5px solid color-mix(in srgb,var(--fg) 16%,var(--line));justify-self:center}
.phone .rail{display:none}
.phone .header-ask{display:none}
.phone .app-header{flex-wrap:nowrap;padding:0 16px}
.phone .app-header h3{font-size:20px}
.phone .bento{grid-template-columns:1fr}
.phone .space-card.cook{grid-row:auto}
.phone .space-card.cook .mosaic{min-height:188px}
.phone .ghosts{grid-template-columns:1fr}
.mobile-top{display:flex;align-items:center;gap:8px;background:var(--rail);color:var(--fg);padding:14px 16px;font-weight:600;border-bottom:1px solid var(--line)}
.mobile-top span:last-child{margin-left:auto;font-size:12px;color:var(--sub)}
.shadcn{margin:8px 0 0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--sub)}
.component-line{font-size:12px}
.motion-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:16px}
.motion-demo{background:#e4ece0;padding:16px;border-radius:14px}
.demo-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.demo-head button{min-height:44px;padding:0 12px;border:1px solid #c8d4c8;border-radius:10px;background:#fff}
.motion-scene{margin-top:12px;min-height:240px;background:#f5f7f2;border-radius:12px;padding:12px;position:relative;overflow:hidden}
.grow-card{width:min(260px,100%)}
.grow-card .mosaic{min-height:148px}
.grow-page{position:absolute;inset:12px;opacity:0;transform:scale(.94);pointer-events:none;background:#f5f7f2;border-radius:12px}
#grow-scene.is-playing .grow-card{animation:grow-away .46s var(--ease-out) forwards}
#grow-scene.is-playing .grow-page{animation:grow-in .46s var(--ease-out) .06s forwards}
.fly-scene{display:grid;grid-template-columns:140px 1fr;gap:12px;align-items:start}
.mini-rail{display:flex;align-items:center;gap:8px;min-height:44px;font-size:13px}
.chip.is-flying{position:relative}
#fly-scene.is-playing .chip.is-flying{animation:chip-fly .48s var(--ease-move) forwards}
.alt-card{background:#fcfdf9;border-radius:14px;padding:28px;box-shadow:0 16px 32px -22px #10241873}
.alt-card h3{font-size:36px;margin-bottom:8px}
.review{border-top:1px solid #c3d0bc;padding:30px 20px 50px}
.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.review-grid p{border-bottom:1px solid #c3d0bc;padding:14px 0}
@keyframes header-shift{50%{background-position:100% 50%}}
@keyframes breathe{50%{opacity:.42}}
@keyframes stagger-in{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@keyframes grow-away{to{opacity:0;transform:scale(1.12)}}
@keyframes grow-in{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:none}}
@keyframes chip-fly{40%{transform:translate(-90px,-36px) scale(.9)}to{transform:translate(-210px,-10px) scale(.68);opacity:.15}}
@media(prefers-reduced-motion:no-preference){
  .ghost{animation:breathe 3.2s var(--ease-move) infinite}
  .ghost:nth-child(2){animation-delay:.45s}
  .ghost:nth-child(3){animation-delay:.9s}
  .stagger .space-card{animation:stagger-in .42s var(--ease-out) both}
  .stagger .space-card:nth-child(2){animation-delay:45ms}
  .stagger .space-card:nth-child(3){animation-delay:90ms}
}
@media(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference){
  .space-card{transition:transform 180ms var(--ease-out),box-shadow 180ms,opacity 180ms}
  .bento:hover .space-card{opacity:.58}
  .bento .space-card:hover{opacity:1}
}
@media(max-width:850px){
  .readme,.phones,.bento,.motion-grid,.review-grid,.ghosts{grid-template-columns:1fr}
  .desktop .rail{display:none}
  .space-card.cook{grid-row:auto}
}
@media(max-width:540px){
  .cover,.readme,.direction,.motion-section,.review{padding-left:14px;padding-right:14px}
  .cover h1{font-size:36px}
  .desktop{display:block}
}
@media(prefers-reduced-motion:reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
}
`;

const script = `
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (!reduce && fine) {
    for (const card of document.querySelectorAll('[data-tilt]')) {
      card.addEventListener('pointermove', (event) => {
        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        card.style.transform = 'perspective(900px) rotateX(' + (-y * 3.4).toFixed(2) + 'deg) rotateY(' + (x * 4.2).toFixed(2) + 'deg)';
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    }
  }
  for (const button of document.querySelectorAll('[data-replay]')) {
    button.addEventListener('click', () => {
      const scene = document.getElementById(button.getAttribute('data-replay'));
      if (!scene) return;
      scene.classList.remove('is-playing');
      void scene.offsetWidth;
      scene.classList.add('is-playing');
    });
  }
  for (const button of document.querySelectorAll('[data-type]')) {
    button.addEventListener('click', () => {
      document.body.classList.toggle('alt-type', button.getAttribute('data-type') === 'display');
    });
  }
})();
`;

await writeFile(
  new URL('../../design/issue-8-review.html', import.meta.url),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sprout #8 — Spaces red-pen review</title><style>${css}</style></head><body>${intro}${sections}${motion}${review}<script>${script}</script></body></html>\n`,
);
console.log(
  `Built review sheet with ${Object.values(counts).reduce((sum, count) => sum + count, 0)} numbered groups.`,
);
