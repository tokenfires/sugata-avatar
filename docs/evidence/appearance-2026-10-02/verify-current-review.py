"""Read-only independent review-packet byte/DOM-receipt audit; no browser or server."""
import datetime
import hashlib
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import platform
import re
import struct
import sys
from urllib.parse import urljoin, urlparse

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
out = Path('captures/current-review-2026-10-02-v1')
report_path = out / 'report.json'
report = json.loads(report_path.read_text())
digest = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
assert digest(report_path) == '1df267e31d7af8a20a7fc86fce0268a2ba257609774cb46582484beea1028410'
assert report['status'] == 'passed' and report['errors'] == []
assert report['cleanup'] == {'page': 'closed', 'browser': 'closed'} and report['borrowedReviewServerRetained']
source_pins, image_pins = {}, {}
for p, expected in report['sourceHashes'].items():
    source_pins[p] = {'live': digest(p), 'snapshot': digest(out / 'sources' / p), 'expected': expected}
    assert source_pins[p]['live'] == source_pins[p]['snapshot'] == expected
def png(path):
    data = Path(path).read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR'
    return struct.unpack('>II', data[16:24])
for p, expected in report['imageInputHashes'].items():
    image_pins[p] = {'sha256': digest(p), 'dimensions': png(p)}
    assert image_pins[p]['sha256'] == expected

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links, self.images, self.pending = [], [], None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'a':
            assert self.pending is None
            self.pending = {'href': a['href'], 'text': ''}
        if tag == 'img':
            self.images.append(a)
    def handle_data(self, data):
        if self.pending is not None:
            self.pending['text'] += data
    def handle_endtag(self, tag):
        if tag == 'a':
            self.links.append(self.pending)
            self.pending = None

page = Links()
page.feed(Path('docs/evidence/appearance-2026-10-02/review.html').read_text())
assert len(page.links) == 14 and len(page.images) == 4
catalogue = re.findall(r"path:\s*'([^']+)',\s*name:\s*'([^']+)'", Path('packages/testbed/pages.js').read_text())
assert len(catalogue) == 17 and len({p for p, _ in catalogue}) == 17
screenshots, views = {}, []
for v in report['views']:
    label, viewport, state = v['label'], v['viewport'], v['review']['state']
    expected_links = [{'text': p['text'], 'url': urljoin(state['url'], p['href'])} for p in page.links]
    assert state['links'] == expected_links
    assert v['hub']['entryHref'] == state['url']
    assert v['hub']['destinations'] == [{'text': name, 'url': urljoin(report['baseUrl'] + '/', p)} for p, name in catalogue]
    assert state['document'][0] <= viewport['width']
    assert state['viewport'] == [viewport['width'], viewport['height']]
    assert len(state['images']) == 4 and len(v['review']['imageResponses']) == 4
    for expected, actual, response in zip(page.images, state['images'], v['review']['imageResponses']):
        assert actual['url'] == urljoin(state['url'], expected['src']) == response['url']
        assert actual['alt'] == expected['alt'] and actual['loaded']
        pin = image_pins[response['file']]
        assert response['status'] == 200 and response['sha256'] == pin['sha256']
        assert (actual['width'], actual['height']) == tuple(pin['dimensions'])
        rect = actual['rect']
        assert rect['x'] >= 0 and rect['y'] >= 0 and rect['x'] + rect['width'] <= viewport['width']
        assert rect['y'] + rect['height'] <= state['document'][1]
        assert abs(rect['width'] / rect['height'] - actual['width'] / actual['height']) < 1e-4
    assert [s['label'] for s in state['sections']] == ['Available in the wardrobe study', 'Hair direction · experimental']
    for s in state['sections']:
        a, b = s['cards']
        for card in (a, b):
            assert 0 <= card['x'] and card['x'] + card['width'] <= viewport['width']
        if label == 'desktop':
            assert a['y'] == b['y'] and b['x'] >= a['x'] + a['width']
        else:
            assert a['x'] == b['x'] and b['y'] >= a['y'] + a['height']
    for key in ('hub', 'review'):
        path = out / v[key]['file']
        dimensions = png(path)
        assert digest(path) == v[key]['sha256']
        assert dimensions == ((viewport['width'], viewport['height']) if key == 'hub' else tuple(state['document']))
        screenshots[str(path)] = {'dimensions': dimensions, 'sha256': digest(path)}
    views.append({'label': label, 'document': state['document'], 'catalogueDestinations': len(v['hub']['destinations']), 'links': len(state['links']), 'decodedExactMedia': len(state['images']), 'layout': 'two columns' if label == 'desktop' else 'one column'})
assert [v['label'] for v in report['views']] == ['desktop', 'mobile']
assert [dict(text=l['text'], url=l['url']) for l in report['linkedResponses']] == report['views'][0]['review']['state']['links']
assert all(l['status'] == 200 for l in report['linkedResponses'])
cta = next(l for l in report['linkedResponses'] if l['text'] == 'Try Saved looks')
assert cta['fragmentVerified'] and urlparse(cta['url']).fragment == 'saved-looks'
assert 'id="saved-looks"' in Path('packages/testbed/src/showcase.html').read_text()
result = {'status': 'independent packet checks passed', 'started': started, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'pid': os.getpid(), 'command': 'python3 docs/evidence/appearance-2026-10-02/verify-current-review.py', 'interpreter': sys.executable, 'pythonVersion': platform.python_version(), 'reportSha256': digest(report_path), 'verifierSha256': digest(__file__), 'sourcePins': source_pins, 'imagePins': image_pins, 'screenshots': screenshots, 'views': views, 'linkResponses': len(report['linkedResponses']), 'limits': ['Saved root browser observations independently reconciled with exact source/image/PNG bytes; no new network or browser run.', 'Recorded Enter activation starts with programmatic focus; no Tab traversal or screen-reader audit.', 'Destination existence/response is navigation evidence, not fresh all-page or Avatar behavior qualification.']}
print(json.dumps(result, indent=2))
