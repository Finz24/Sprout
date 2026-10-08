"""Check the generated workflow documents and diagram, without claiming app tests."""
import importlib.util
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('builder', ROOT / 'scripts/build-workflows.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
flows = builder.read_flows()
document = (ROOT / 'docs/action-flows.md').read_text(encoding='utf-8')
for flow in flows:
    assert '## ' + flow['id'] + ' · ' + flow['title'] in document
    for rule in flow['rules'] + flow['open']:
        assert '- ' + rule in document, 'Missing workflow contract in Markdown: ' + flow['id']
fragment = builder.OUTPUT.read_text(encoding='utf-8')
assert len(fragment.encode()) < 1_000_000
assert '<script' not in fragment and '<foreignObject' not in fragment
assert not re.search(r'<!doctype|<(?:html|head|body)\b', fragment, re.I)
assert len(re.findall(r'<details class="chapter"', fragment)) == 13
assert len(re.findall(r'<details class="rules"', fragment)) == 13
svgs = re.findall(r'<svg\b.*?</svg>', fragment, re.S)
assert len(svgs) == 13
ids = re.findall(r'\sid="([^"]+)"', fragment)
assert len(ids) == len(set(ids)), 'Duplicate HTML/SVG ID'
page = builder.STANDALONE.read_text(encoding='utf-8')
assert fragment in page, 'Stale standalone workflow page'
assert page.lower().startswith('<!doctype html>')
assert '<meta charset="utf-8">' in page and '<meta name="viewport"' in page
assert '<title>Sprout connected flows</title>' in page
for token in ['background', 'foreground', 'muted-foreground', 'border', 'secondary', 'viz-series-1', 'orange', 'purple']:
    assert re.search(r'--' + token + r'\s*:', page), 'Missing standalone theme token: ' + token
assert '<script' not in page and '<!--__WORKFLOW_FRAGMENT__-->' not in page
for flow, svg in zip(flows, svgs):
    root = ElementTree.fromstring(svg)
    assert root.attrib['id'] == 'sprout_' + flow['id']
    local_ids = {e.attrib['id'] for e in root.iter() if 'id' in e.attrib}
    for ref in re.findall(r'url\(#([^)]*)\)', svg):
        assert ref in local_ids, 'Broken SVG marker reference: ' + ref
    nodes = [e for e in root.iter() if 'node' in e.attrib.get('class', '').split()]
    edges = [e for e in root.iter() if 'flowchart-link' in e.attrib.get('class', '').split()]
    assert len(nodes) == len(flow['nodes']), flow['id']
    # Mermaid renders a self-loop as three path segments, but it is one logical edge.
    expected_segments = len(flow['edges']) + 2 * sum(e['from'] == e['to'] for e in flow['edges'])
    assert len(edges) == expected_segments, flow['id']
paths = [ROOT / 'README.md', ROOT / 'AGENTS.md', ROOT / 'CONTEXT.md', ROOT / 'scripts/README.md', *sorted((ROOT / 'docs').rglob('*.md'))]
for path in paths:
    for link in re.findall(r'\]\(([^)]+)\)', path.read_text(encoding='utf-8')):
        if not re.match(r'https?://|#', link):
            assert (path.parent / link.split('#')[0]).exists(), (str(path.relative_to(ROOT)), link)
assert 'https://' not in (ROOT / 'scripts/workflow-builder.html').read_text(encoding='utf-8'), 'Unexpected runtime network dependency'
print(json.dumps({'journeys':len(flows), 'nodes':sum(len(f['nodes']) for f in flows), 'connections':sum(len(f['edges']) for f in flows), 'fragment_bytes':len(fragment.encode()), 'runtime_scripts':0, 'checks':'PASS: workflow contracts, graph identities, SVG XML/markers, native controls, standalone encoding/theme, local links and offline builder'}, indent=2))
