"""Documentation-only builder. Source: docs/workflow-data.json.

python scripts/build-workflows.py --serve
Open http://127.0.0.1:8781/build and select Build diagrams.
The browser renders pinned Mermaid to SVG; the local server writes only known
graph IDs, then builds docs/action-flows.md and the script-free HTML fragment.
python scripts/build-workflows.py --assemble reuses the SVG cache.
"""
import argparse
import hashlib
import html
import json
import mimetypes
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'docs/workflow-data.json'
CACHE = ROOT / 'outputs/workflow-svg'
OUTPUT = ROOT / 'outputs/sprout-connected-flows.html'
STANDALONE = ROOT / 'outputs/sprout-connected-flows-standalone.html'

def standalone(fragment):
    template = (ROOT / 'scripts/workflow-standalone.html').read_text(encoding='utf-8')
    return template.replace('<!--__WORKFLOW_FRAGMENT__-->', fragment)

def read_flows():
    flows = json.loads(DATA.read_text(encoding='utf-8'))
    assert len({f['id'] for f in flows}) == len(flows)
    for flow in flows:
        ids = {n['id'] for n in flow['nodes']}
        assert len(ids) == len(flow['nodes'])
        assert all(e['from'] in ids and e['to'] in ids for e in flow['edges'])
    return flows

def wrap(value, limit=16):
    lines, line = [], ''
    for word in value.split():
        if line and len(line + ' ' + word) > limit:
            lines.append(line)
            line = word
        else:
            line += (' ' if line else '') + word
    if line:
        lines.append(line)
    return '<br/>'.join(lines).replace('&', '&amp;')

def graph(flow):
    lines = ['flowchart TD']
    for node in flow['nodes']:
        label = wrap(node['label'])
        if node['kind'] == 'open':
            label += '<br/>Decision needed'
        shape = '{"' + label + '"}' if node['kind'] == 'decision' else '["' + label + '"]'
        lines.append(node['id'] + shape)
        if node['kind'] != 'step':
            lines.append('class ' + node['id'] + ' ' + node['kind'])
    for edge in flow['edges']:
        # Mermaid's self-loop edge-label renderer cannot lay out explicit newlines.
        limit = 1000 if edge['from'] == edge['to'] else 18
        lines.append(edge['from'] + ' -->|"' + wrap(edge['label'], limit) + '"| ' + edge['to'])
    return '\n'.join(lines)

def digest(source):
    return hashlib.sha256(source.encode()).hexdigest()

def markdown(flows):
    result = ['# Sprout action flows', '', 'Current journey contracts, updated October 3, 2026. These describe required behavior, not an implemented application. See [product direction](product-direction.md), [architecture](architecture.md), [open decisions](open-decisions.md) and [source corpus](source-validation-corpus.md).', '', 'Core, Later and Advanced label delivery scope. Nodes marked Decision needed name unresolved policy; arrows through them describe required outcomes, not a selected policy. Cross-journey labels name the destination step. Each section\'s rules complete its compact map; no diagram claims to enumerate all possible real-world inputs.', '', 'Maintainer: edit `workflow-data.json`, then use `scripts/build-workflows.py` to rebuild this document and the diagram together. See [builder instructions](../scripts/README.md).', '']
    for flow in flows:
        result += ['## ' + flow['id'] + ' · ' + flow['title'], '', flow['stage'], '', '```mermaid', graph(flow), '```', '', '### Behavior contract', '']
        result += ['- ' + rule for rule in flow['rules']]
        if flow['open']:
            result += ['', '### Still to decide', ''] + ['- ' + rule for rule in flow['open']]
        result += ['']
    return '\n'.join(result)

def clean_svg(value, name):
    root_id = re.search(r'<svg\b[^>]*\sid="([^"]+)"', value)[1]
    for identifier in set(re.findall(r'\sid="([^"]+)"', value)):
        if identifier == root_id:
            continue
        scoped = root_id + '__' + identifier
        value = value.replace(' id="' + identifier + '"', ' id="' + scoped + '"')
        value = value.replace('url(#' + identifier + ')', 'url(#' + scoped + ')')
        value = value.replace('href="#' + identifier + '"', 'href="#' + scoped + '"')
        value = value.replace('aria-labelledby="' + identifier + '"', 'aria-labelledby="' + scoped + '"')
        value = value.replace('aria-describedby="' + identifier + '"', 'aria-describedby="' + scoped + '"')
    value = re.sub(r'<style\b[^>]*>.*?</style>', '', value, flags=re.S)
    value = re.sub(r'\sstyle="[^"]*"', '', value)
    value = value.replace('&amp;amp;', '&amp;')
    value = re.sub(r'(<svg\b[^>]*?)\swidth="[^"]*"', r'\1', value, count=1)
    value = re.sub(r'(<svg\b[^>]*?)\sheight="[^"]*"', r'\1', value, count=1)
    value = re.sub(r'(<svg\b[^>]*?)\srole="[^"]*"', r'\1', value, count=1)
    value = re.sub(r'(<svg\b[^>]*?)\sclass="[^"]*"', r'\1', value, count=1)
    value = value.replace('<svg ', '<svg class="flow-diagram" role="img" aria-label="' + html.escape(name, quote=True) + '" ', 1)
    # Round geometry only; never alter IDs, labels or marker viewBoxes.
    def geometry(match):
        return match[1] + re.sub(r'-?\d+\.\d+', lambda n: str(round(float(n[0]), 2)), match[2]) + '"'
    value = re.sub(r'((?:d|points|transform|x|y|width|height)=")([^"<>]*)"', geometry, value)
    assert '<foreignObject' not in value and '<script' not in value
    return value

def assemble():
    flows = read_flows()
    chapters, responsive = [], []
    for flow in flows:
        record = json.loads((CACHE / (flow['id'] + '.json')).read_text(encoding='utf-8'))
        assert record['hash'] == digest(graph(flow)), 'Stale SVG for ' + flow['id'] + '; rebuild in browser'
        svg = clean_svg(record['svg'], flow['title'])
        view = re.search(r'<svg[^>]+viewBox="([^"]+)"', svg)[1].split()
        # Below 11px apparent SVG text, use full-size explicit source/edge/target routes.
        threshold = max(360, round(float(view[2]) * 11 / 14))
        responsive.append('#sprout-workflows #sprout_' + flow['id'] + ' {max-width:' + view[2] + 'px;margin-inline:auto}')
        responsive.append('@container (max-width: ' + str(threshold) + 'px) { #sprout-workflows #chapter-' + flow['id'] + ' .flow-diagram {display:none} #sprout-workflows #chapter-' + flow['id'] + ' .routes {display:block} }')
        labels = {n['id']: n['label'] for n in flow['nodes']}
        routes = '<ol class="routes" aria-label="Connected routes">' + ''.join('<li><span>' + html.escape(labels[e['from']]) + '</span><span class="route-target"><span class="route-label">' + html.escape(e['label']) + '</span> → ' + html.escape(labels[e['to']]) + '</span></li>' for e in flow['edges']) + '</ol>'
        rules = '<details class="rules"><summary>Actions, rules and unresolved cases</summary><ul>' + ''.join('<li>' + html.escape(r) + '</li>' for r in flow['rules']) + '</ul>'
        if flow['open']:
            rules += '<h3>Still to decide</h3><ul>' + ''.join('<li>' + html.escape(r) + '</li>' for r in flow['open']) + '</ul>'
        rules += '</details>'
        chapters.append('<details class="chapter" id="chapter-' + flow['id'] + '"' + (' open' if flow['id'] == '00' else '') + '><summary>' + flow['id'] + ' · ' + html.escape(flow['title']) + '<span class="chapter-stage text-small">' + html.escape(flow['stage']) + '</span></summary><div class="chapter-content">' + svg + routes + rules + '</div></details>')
    template = (ROOT / 'scripts/workflow-template.html').read_text(encoding='utf-8')
    fragment = template.replace('/*__RESPONSIVE_RULES__*/', '\n'.join(responsive)).replace('<!--__CHAPTERS__-->', '\n'.join(chapters))
    assert len(fragment.encode()) < 1_000_000
    OUTPUT.write_text(fragment, encoding='utf-8')
    STANDALONE.write_text(standalone(fragment), encoding='utf-8')
    (ROOT / 'docs/action-flows.md').write_text(markdown(flows), encoding='utf-8')
    return f"Built {len(flows)} journeys, {sum(len(f['nodes']) for f in flows)} nodes, {sum(len(f['edges']) for f in flows)} connections; {len(fragment.encode())} bytes."

class Handler(BaseHTTPRequestHandler):
    def reply(self, content, mime='text/plain; charset=utf-8'):
        value = content.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(value)))
        self.end_headers()
        self.wfile.write(value)

    def do_GET(self):
        if self.path == '/build':
            self.reply((ROOT / 'scripts/workflow-builder.html').read_text(encoding='utf-8'), 'text/html; charset=utf-8')
        elif self.path == '/graphs':
            self.reply(json.dumps([{'id':f['id'], 'source':graph(f)} for f in read_flows()]), 'application/json')
        elif self.path == '/':
            # A portable document with its own encoding and theme, also usable from disk.
            self.reply(standalone(OUTPUT.read_text(encoding='utf-8')), 'text/html; charset=utf-8')
        elif self.path.startswith('/mermaid/') and self.server.mermaid_dir:
            directory = Path(self.server.mermaid_dir).resolve()
            target = (directory / self.path.removeprefix('/mermaid/')).resolve()
            if not target.is_relative_to(directory) or not target.is_file():
                self.send_error(404)
                return
            self.reply(target.read_text(encoding='utf-8'), mimetypes.guess_type(str(target))[0] or 'text/javascript')
        else:
            self.send_error(404)

    def do_POST(self):
        # Local documentation build writes only fixed filenames and known graph IDs.
        host = self.headers.get('Host', '')
        if host not in ('127.0.0.1:' + str(self.server.server_port), 'localhost:' + str(self.server.server_port)):
            self.send_error(403)
            return
        origin = self.headers.get('Origin')
        if origin and origin not in ('http://127.0.0.1:' + str(self.server.server_port), 'http://localhost:' + str(self.server.server_port)):
            self.send_error(403)
            return
        try:
            if self.path == '/assemble':
                self.reply(assemble())
                return
            identifier = self.path.removeprefix('/svg/')
            flow = next((f for f in read_flows() if f['id'] == identifier), None)
            if not self.path.startswith('/svg/') or flow is None:
                self.send_error(404)
                return
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length < 1_000_000:
                self.send_error(413)
                return
            svg = self.rfile.read(length).decode('utf-8')
            assert svg.startswith('<svg') and '<script' not in svg and '<foreignObject' not in svg
            CACHE.mkdir(parents=True, exist_ok=True)
            (CACHE / (identifier + '.json')).write_text(json.dumps({'hash':digest(graph(flow)), 'svg':svg}), encoding='utf-8')
            self.reply('Saved ' + identifier)
        except Exception as error:
            self.send_error(500, str(error))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--serve', action='store_true')
    parser.add_argument('--assemble', action='store_true')
    parser.add_argument('--port', type=int, default=8781)
    parser.add_argument('--mermaid-dir', help='Local Mermaid 11.12.0 dist directory; required only to render changed graphs')
    args = parser.parse_args()
    if args.assemble:
        print(assemble())
    if args.serve:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
        server.mermaid_dir = args.mermaid_dir
        print(f'Build: http://127.0.0.1:{args.port}/build; preview: http://127.0.0.1:{args.port}/', flush=True)
        server.serve_forever()
