import { readFile, writeFile } from 'node:fs/promises';

const font = await readFile(
  new URL('../../../apps/web/src/assets/inter-variable.woff2', import.meta.url),
);
const counts = {};
const number = (prefix) => {
  counts[prefix] = (counts[prefix] ?? 0) + 1;
  const id = `${prefix}${String(counts[prefix]).padStart(2, '0')}`;
  return `<span class="pen" id="${id}">${id}</span>`;
};
const p = (prefix, text, cls = '') =>
  `<p class="${cls}">${number(prefix)}${text}</p>`;
const button = (prefix, text, cls = '') =>
  `<button disabled class="button ${cls}">${number(prefix)}${text}</button>`;
const sproutMark = `<svg class="sprout-symbol" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 29V15" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M16 17C15 11 10.5 8 5 8.4 5.2 14 9.6 17.4 16 17ZM16 14C16.6 7.8 21 4 27.4 4 27.5 10.4 23 14 16 14Z" fill="currentColor"/></svg>`;
const greenhouse = `<div class="greenhouse-art" aria-hidden="true"><div class="arch arch-one"></div><div class="arch arch-two"></div><div class="arch arch-three"></div><div class="leaf-plane one"></div><div class="leaf-plane two"></div><div class="glass-shelf"><i></i><i></i><i></i></div></div>`;
const original = `Lemon cake
200 g flour
2 eggs
Bake 40 minutes
“Remind me Friday.”`;
const rail = (prefix) =>
  `<aside class="rail"><div class="wordmark">${number(prefix)}${sproutMark}sprout</div><nav>${p(prefix, 'Library', 'selected')}${p(prefix, 'Find and ask')}${p(prefix, 'Spaces')}${p(prefix, 'Settings')}</nav></aside>`;
const facts = (prefix) =>
  `<div class="fact-bento">${['Flour|200 g|wide', 'Eggs|2|', 'Bake|40 min|']
    .map((entry) => {
      const [label, value, extra] = entry.split('|');
      return `<article class="fact ${extra}">${number(prefix)}<span>${label}</span><strong>${value}</strong></article>`;
    })
    .join('')}</div>`;
const snapshot = (prefix) =>
  `<dl class="snapshot">${p(prefix, 'Analyzed', 'snap-k')}<dd>text</dd>${p(prefix, 'Instructions', 'snap-k')}<dd>built-in default</dd>${p(prefix, 'Provider and model', 'snap-k')}<dd>wait for Ohad</dd></dl>`;
const readyBody = (prefix, phone) =>
  `<div class="canopy">${greenhouse}<div class="canopy-copy"><h3>${number(prefix)}${phone ? 'Lemon cake.' : 'Lemon cake\nfor Friday.'}</h3>${p(prefix, 'Recipe. Originals stay.', 'canopy-description')}</div></div>
  <section class="paper" data-component="Card">
    <div class="paper-top">
      <div>
        <h4>${number(prefix)}200 g flour. Two eggs. Bake 40 minutes.</h4>
        ${p(prefix, 'Cook Friday. Your reason, not the recipe.', 'muted')}
      </div>
      <span class="badge" data-component="Badge">${number(prefix)}Recipe</span>
    </div>
    <div class="tabs" data-component="Tabs">
      <div class="tab-list"><span class="tab on">${number(prefix)}Understanding</span><span class="tab">${number(prefix)}Original</span></div>
    </div>
    <div class="sep" data-component="Separator"></div>
    ${facts(prefix)}
    <details class="acc" data-component="Accordion" open>
      <summary>${number(prefix)}Evidence</summary>
      ${p(prefix, '200 g flour is in the original. Eggs and bake time are too.', 'muted')}
    </details>
    <details class="acc" data-component="Accordion" open>
      <summary>${number(prefix)}Model and instructions</summary>
      ${snapshot(prefix)}
    </details>
    <div class="original-peek">
      <span>${number(prefix)}Original</span>
      <pre dir="auto">${original}</pre>
    </div>
    ${p(prefix, 'New · Ready · Not scheduled', 'status-line')}
  </section>`;
const failedBody = (prefix) =>
  `<div class="canopy failed-canopy">${greenhouse}<div class="canopy-copy"><h3>${number(prefix)}Original is safe.</h3>${p(prefix, 'Understanding did not finish.', 'canopy-description')}</div></div>
  <section class="paper" data-component="Card">
    <div class="alert" data-component="Alert" role="status">${number(prefix)}Understanding failed. Originals stay.</div>
    <div class="paper-top">
      <h4>${number(prefix)}Lemon cake</h4>
      <span class="badge quiet" data-component="Badge">${number(prefix)}Failed</span>
    </div>
    <pre class="original-safe" dir="auto">${original}</pre>
    ${p(prefix, 'Original kept exactly.', 'muted')}
    ${p(prefix, 'Repair this attempt. This does not save again.', 'muted')}
    ${button(prefix, 'Repair', 'primary')}
    ${p(prefix, 'New · Failed · Not scheduled', 'status-line')}
  </section>`;
const specimen = (prefix, theme, phone, kind) => {
  const title = `${phone ? 'Galaxy' : 'Desktop'} / ${theme} / ${kind}`;
  const body = kind === 'failed' ? failedBody(prefix) : readyBody(prefix, phone);
  const frame = phone
    ? `<div class="mobile-top">${number(prefix)}${sproutMark}sprout<span>Back</span></div>${body}`
    : `${rail(prefix)}<div class="workspace"><div class="toolbar">${p(prefix, 'Find something you kept', 'search-sample')}${p(prefix, 'Private library', 'muted')}</div>${body}</div>`;
  return `<article class="specimen"><div class="spec-caption">${number(prefix)}${title}<span>Synthetic</span></div><div class="screen ${theme} ${phone ? 'phone' : 'desktop'} kind-${kind}">${frame}</div></article>`;
};

const intro = `<header class="cover"><div class="cover-top">${p('I', 'sprout / design review')}${p('I', 'Issue #5 · 25 October 2026')}</div>
<h1>${number('I')}What this is.<br>What you kept.</h1>
${p('I', 'Understanding first. Original one tap away.', 'cover-description')}
<div class="cover-bottom">${p('I', 'Static review sheet · awaiting Ohad markup')}${p('I', 'Ready and failed states')}</div></header>
<section class="readme">${p('I', 'Mark IDs. Write “R04: shorter summary” or “F02: keep this alert”. Controls are disabled.')}
${p('I', 'Named shadcn targets: Card, Badge, Tabs, Separator, Accordion, Alert, Button. Inter only.', 'muted')}</section>`;

const ready = `<section class="direction" id="ready"><div class="direction-heading"><div><h2>${number('R')}Ready. The item is useful.</h2>${p('R', 'Raised paper over the canopy. Uneven fact tiles. Evidence and the snapshot stay on the page.')}</div><span class="recommend">${number('R')}Conservatory extended</span></div>
${specimen('R', 'light', false, 'ready')}${specimen('R', 'dark', false, 'ready')}
<div class="phones">${specimen('R', 'light', true, 'ready')}${specimen('R', 'dark', true, 'ready')}</div></section>`;

const failed = `<section class="direction" id="failed"><h2>${number('F')}Failed. Repair the stage.</h2>
${p('F', 'Originals stay. Repair does not create a second save.')}
${specimen('F', 'light', false, 'failed')}${specimen('F', 'dark', false, 'failed')}
<div class="phones">${specimen('F', 'light', true, 'failed')}${specimen('F', 'dark', true, 'failed')}</div></section>`;

const motion = `<section class="motion-section" id="motion"><h2>${number('M')}Motion has one job.</h2>
${p('M', 'Replay a 220 ms paper reveal for an already-published Ready state.')}
<details class="motion-demo"><summary>${number('M')}Replay paper reveal</summary><div class="motion-scene light">${readyBody('M', false)}</div></details>
${p('M', 'Failed uses a 180 ms alert shake. Reduced motion removes both. Status never waits.', 'muted')}</section>`;

const review = `<footer class="review"><h2>${number('Q')}Two questions only Ohad can answer.</h2>
${p('Q', '1. Which live provider and model may run the one authorized journey.')}
${p('Q', '2. The spend cap for that journey and for later processing.')}
<div class="review-grid">${p('Q', 'Keep / ______________________________________')}${p('Q', 'Change / ____________________________________')}</div>
${p('Q', 'Keyboard: visible focus, 44px targets, labels, dir=auto original. Light is daytime desktop. Dark is evening phone.', 'muted')}</footer>`;

const css = `
@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font.toString('base64')}) format('woff2');font-weight:100 900;font-style:normal;font-display:swap}
*{box-sizing:border-box}html,body{margin:0;background:#eef2ea;color:#1e3026;font:15px/1.5 Inter,sans-serif}button{font:inherit}h1,h2,h3,h4,p,pre,dl,dd{margin:0}h1,h2,h3,h4{line-height:1.1;letter-spacing:-.028em}h2{font-size:32px}h3{font-size:40px;font-weight:560}h4{font-size:22px;font-weight:580}p{margin:10px 0}pre{font:inherit;white-space:pre-wrap}::selection{background:#bfd4bf;color:#183324}
.pen,.muted .pen,.dark .pen{display:inline-block;vertical-align:middle;font:600 11px/1.4 Inter,sans-serif;letter-spacing:0;color:#6c3a38;background:#fff0e9;border:1px solid #d4aaa0;border-radius:4px;padding:0 4px;margin-right:7px;white-space:nowrap}
.cover{background:#1f3a2c;color:#f4f7ed;padding:32px max(24px,calc((100% - 1180px)/2)) 44px}
.cover-top,.cover-bottom{display:flex;justify-content:space-between;gap:24px;font-size:13px;color:#cedcc9}
.cover h1{font-size:clamp(36px,5.4vw,70px);font-weight:540;margin:36px 0 22px;max-width:980px}
.cover-description{max-width:560px;font-size:20px;color:#d5e3cf}
.cover-bottom{border-top:1px solid #52705b;margin-top:36px;padding-top:16px}
.readme,.direction,.motion-section,.review{max-width:1180px;margin:36px auto;padding:0 20px}
.readme{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.muted{color:var(--sub,#526258)}
.direction-heading{display:flex;justify-content:space-between;gap:28px;align-items:start}
.recommend{background:#dae7d4;color:#244a32;padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;white-space:nowrap}
.specimen{margin:22px 0}.spec-caption{display:flex;gap:8px;font-size:12px;color:#4e6255;margin:0 0 8px}.spec-caption>span:last-child{margin-left:auto;color:#647368}
.screen{--bg:#f5f7f2;--fg:#1e3026;--sub:#526258;--line:#c8d4c8;--card:#fbfcf9;--sage:#e4ece2;--tile:#dfe9dc;--primary:#315b42;--on:#fff;background:var(--bg);color:var(--fg);color-scheme:light;border-radius:18px;overflow:hidden;box-shadow:0 16px 40px -22px #0b1a124d}
.dark{--bg:#111b15;--fg:#e4ede6;--sub:#b0c0b5;--line:#33453a;--card:#17251c;--sage:#1a2920;--tile:#24372b;--primary:#9bc7a5;--on:#112016;color-scheme:dark;box-shadow:0 18px 36px -22px #0008}
.desktop{display:flex;min-height:760px}
.rail{width:188px;flex-shrink:0;padding:26px 16px;background:#e9eee5;color:#1e3026;display:flex;flex-direction:column;border-right:1px solid var(--line)}
.dark .rail{background:#142119;color:#e4ede6;border-color:#2b3c31}
.wordmark{display:flex;align-items:center;font-size:22px;font-weight:650;letter-spacing:-.035em}
.sprout-symbol{width:24px;height:24px;margin-right:7px}
.rail nav{margin-top:36px}.rail nav p{padding:11px 10px;margin:6px 0;color:inherit}
.selected{background:#d5e5c9;color:#203c2d;border-radius:10px;font-weight:600}
.dark .selected{background:#24372b;color:#e4ede6}
.workspace{flex:1;min-width:0;display:flex;flex-direction:column;background:var(--sage)}
.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:10px 26px;font-size:12px;background:var(--bg)}
.search-sample{min-width:50%;color:var(--sub)}
.canopy{position:relative;isolation:isolate;min-height:198px;background:#2c5039;color:#f1f6e9;overflow:hidden}
.dark .canopy{background:#163326}
.failed-canopy{background:#4a3428}
.dark .failed-canopy{background:#3a261c}
.dark .arch{border-color:#d5e8b888;background:linear-gradient(125deg,#d4e8b855,#2a553800)}
.dark .leaf-plane.one{background:#b6d68a66}
.dark .leaf-plane.two{background:#e6f3c260}
.canopy-copy{position:relative;z-index:1;padding:28px 32px 64px;max-width:560px}
.canopy h3{white-space:pre-line}
.canopy-description{color:#d8e7cf;font-size:14px}
.greenhouse-art{position:absolute;inset:0 0 0 38%;opacity:.92;pointer-events:none}
.arch{position:absolute;width:175px;height:300px;border:1px solid #c4d9a866;border-radius:110px 110px 0 0;bottom:-90px;transform:rotate(22deg);background:linear-gradient(125deg,#c5d9a640,#426b3f00)}
.arch-one{right:-16px;width:190px;bottom:-30px}.arch-two{right:120px;bottom:-80px}.arch-three{right:250px;bottom:-130px}
.leaf-plane{position:absolute;border-radius:40% 60% 70% 30%}
.leaf-plane.one{right:80px;bottom:-20px;width:220px;height:90px;background:#9cbe7a55;transform:rotate(-18deg)}
.leaf-plane.two{right:200px;bottom:40px;width:160px;height:70px;background:#d4e6b450;transform:rotate(12deg)}
.glass-shelf{position:absolute;right:36px;bottom:28px;display:flex;align-items:end;gap:12px;transform:rotate(-12deg)}
.glass-shelf i{display:block;background:#8cab7752;width:72px;height:92px;border-radius:10px;box-shadow:0 16px 24px #0e2b2733}
.glass-shelf i:nth-child(2){height:136px;background:#bed2a63d}
.paper{position:relative;z-index:2;margin:-48px 24px 24px;background:var(--card);border-radius:16px;padding:24px;box-shadow:0 22px 50px -23px #102c2470}
.dark .paper{box-shadow:0 18px 36px -20px #0007}
.paper-top{display:flex;justify-content:space-between;gap:16px;align-items:start}
.badge{display:inline-flex;align-items:center;min-height:28px;padding:4px 10px;border-radius:999px;background:var(--tile);color:var(--fg);font-size:12px;font-weight:650}
.badge.quiet{background:#f3d6c8;color:#6c422f}
.dark .badge.quiet{background:#503b32;color:#ffd0c1}
.tabs{margin:16px 0 8px}.tab-list{display:flex;gap:8px;width:fit-content}
.tab{min-height:40px;display:inline-flex;align-items:center;padding:0 12px;border-radius:8px;color:var(--sub)}
.tab.on{background:var(--tile);color:var(--fg);font-weight:650}
.sep{height:1px;background:var(--line);margin:10px 0 16px}
.fact-bento{display:grid;grid-template-columns:1.8fr .7fr .8fr;gap:10px}
.fact{background:var(--tile);border-radius:14px;padding:16px 18px;min-height:96px}
.fact.wide{background:#d7e4ce}
.dark .fact.wide{background:#2f4a38}
.fact span{display:block;font-size:12px;color:var(--sub);margin-bottom:8px}
.fact strong{font-size:28px;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.acc{margin:12px 0;border-top:1px solid var(--line);padding-top:10px}
.acc summary{min-height:44px;cursor:default;font-weight:600}
.snapshot{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;margin-top:8px}
.snapshot p,.snapshot dd{margin:0;font-size:13px}.snapshot dd{color:var(--fg)}
.original-peek{margin-top:16px;padding:12px 14px;border-radius:12px;background:var(--sage)}
.original-peek span{display:block;font-size:12px;color:var(--sub);font-weight:600;margin-bottom:6px}
.original-peek pre{max-height:4.8em;overflow:hidden;color:var(--fg)}
.status-line{font-size:12px;color:var(--sub);margin-top:16px}
.alert{background:#faf0e9;color:#6c422f;border-radius:12px;padding:16px;margin-bottom:16px}
.dark .alert{background:#352b24;color:#e5bf9e}
.kind-failed .alert{animation:alert-shake 180ms cubic-bezier(.36,.07,.19,.97) both}
.original-safe{margin:14px 0;padding:14px 16px;border-radius:12px;background:var(--sage);line-height:1.55}
.button{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:9px 16px;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--fg);font-weight:600}
.button.primary{background:var(--primary);color:var(--on);border-color:transparent;box-shadow:0 8px 16px -12px #0b1a1266}
.dark .button.primary{box-shadow:none}
.button:focus-visible,summary:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
.phones{display:grid;grid-template-columns:1fr 1fr;gap:28px}
.phone{min-height:720px;border-radius:22px;display:flex;flex-direction:column}
.mobile-top{display:flex;align-items:center;gap:6px;background:#e9eee5;color:#1e3026;padding:14px 18px;font-weight:600;font-size:20px;border-bottom:1px solid var(--line)}
.dark .mobile-top{background:#142119;color:#e4ede6;border-color:#2b3c31}
.mobile-top span:last-child{margin-left:auto;font-size:12px}
.phone .canopy{min-height:156px}.phone .canopy-copy{padding:22px 18px 52px}.phone .canopy h3{font-size:32px}
.phone .paper{margin:-36px 12px 16px;padding:18px}.phone .paper-top{flex-direction:column;align-items:start;gap:10px}
.phone .fact-bento{display:grid;grid-template-columns:1fr 1fr}.phone .fact.wide{grid-column:1/-1}
.phone .greenhouse-art{left:48%}.phone .glass-shelf{display:none}
.phone .snapshot{grid-template-columns:1fr}
.phone .original-peek pre{max-height:3.2em}
.motion-demo{margin-top:20px;background:#e3eadf;padding:20px;border-radius:12px}
.motion-demo summary{min-height:44px;cursor:pointer;font-weight:600;padding:10px}
.motion-scene{margin-top:12px;border-radius:16px;overflow:hidden;background:#f5f7f2}
.motion-demo[open] .motion-scene{animation:panel-reveal 220ms cubic-bezier(.16,1,.3,1) both}
@keyframes panel-reveal{from{opacity:.7;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes alert-shake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-3px)}40%,60%{transform:translateX(3px)}}
.review{border-top:1px solid #b8cbb3;padding-top:28px;padding-bottom:48px}
.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:20px 0}
.review-grid p{padding:14px 0;border-bottom:1px solid #c3d0bc}
.fact,.paper{transition:transform 160ms cubic-bezier(.16,1,.3,1),box-shadow 160ms ease-out}
@media(hover:hover) and (prefers-reduced-motion:no-preference){.fact:hover{transform:translateY(-2px);box-shadow:0 12px 20px -16px #142c2566}}
@media(max-width:850px){.readme,.direction-heading,.phones,.review-grid,.snapshot{display:block}.desktop .rail{display:none}.desktop .fact-bento{grid-template-columns:1.4fr 1fr}.recommend{display:inline-block;margin:12px 0}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

await writeFile(
  new URL('../../design/issue-5-review.html', import.meta.url),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sprout #5 — Understand a text save</title><style>${css}</style></head><body>${intro}${ready}${failed}${motion}${review}</body></html>\n`,
);
console.log(
  `Built review sheet with ${Object.values(counts).reduce((a, b) => a + b, 0)} numbered groups.`,
);
