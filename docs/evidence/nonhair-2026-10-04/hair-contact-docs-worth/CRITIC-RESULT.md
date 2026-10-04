# Final API paragraph review

**Accept the exact paragraph at docs/API.md:384–391.** I read all eight text lines, adjoining availability/preview paragraphs and the complete current API diff. The diff contains only this paragraph plus its separating blank line. No further actionable wording issue remains; source investigation stops here before06:50UTC October4.

The opening distinguishes attachment from the body-contact path. The dynamic-path qualifier and possible source-validation refusal correctly preserve the actual bob01 g025/g050 lookup condition without promising lookup/activation for every eligible attached groom. The null-report/no-dynamic-solver sentence matches Avatar's optional hairDynamics/contactReport expression. It names both current report fields and declines fit/motion certification. Nothing links missing calibration to the Rowan fringe/neck-band artistic refusal, certifies bob02 contact, or changes runtime support/defaults.

The relative g100 evidence link resolves from docs/API.md to the actual retained `docs/evidence/nonhair-2026-10-04/rowan-portrait/FRONT-STATE.json`. A finite FS JSON read confirms its actual front hair fields: attachedtrue, loadedStylebob01, bodyContactnull, and `No body-contact calibration for bob01 on figure_g100.` This is a real returned-state example; it does not turn the refused portrait into accepted appearance. I did not use a browser to qualify the rendered Markdown or navigation.

**A, recommended:** adopt this exact short consumer-facing explanation. It fills the verified documentation gap with current source and a concrete report example. **B:** retain the prior API paragraph alone. B is smaller but omits the independently reported contact distinction. No table, implementation, new warning or empirical test is necessary for this documentation change; accepted assets and the full appearance/representation roadmap remain unchanged.

Exact final bindings from source/diff/hash readback exit0/chunk `c0a605`, clock observation06:47:15UTC (PID/full start/end not recorded):

- final docs/API.md: `524541f8e1abd3ed578ae13dd64d8f3b471ddadf065629e961cdcdb71ca28190`;
- linked FRONT-STATE.json: `0750ac1a398ead10f45752c941d35c3147c08bc2cd7a7c20f2c640257bc94a99`;
- governing CRITIC-WORTH.md: `39928397df2f101e3618fcf9e5c880c47e10d1ce8ce45ff09734f6054de29cd9`.

The only subsequent command was this saved-state/path read, with no module import, asset parsing, helper execution, runtime or new investigation:

```python
from pathlib import Path
import json
api=Path('docs/API.md')
relative='evidence/nonhair-2026-10-04/rowan-portrait/FRONT-STATE.json'
target=(api.parent/relative).resolve()
d=json.loads(target.read_text())
h=d['views'][0]['report']['hair']
print(target)
print(json.dumps({k:h[k] for k in ['attached','loadedStyle','bodyContact','bodyContactUnavailableReason']}))
```

It printed the correct absolute target and those four literal fields, exit0/chunk `265723`; PID/start/end not returned. No docs/product mutation, native/browser/GPU/test or live critic job occurred. This new result note is the sole critic closeout output.
