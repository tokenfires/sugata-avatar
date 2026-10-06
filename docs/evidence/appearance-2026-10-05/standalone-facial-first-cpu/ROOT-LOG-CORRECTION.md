# Quoted stderr metadata correction

The critic independently found that ROOT-COLLECTION.json's `actual_error_text` quotes two final line feeds. The retained actual reader.stderr is exactly35bytes: `b'Traceback (most recent call last):\n'`, one final LF, SHA2565b5219954d38b8245d6083467c9471169a66e4dd94a1a76bacdbdf21758a9ee6. Root independently checked the complete raw bytes, repr and hex. The original log/path/size/hash were always correct; root's printed-text copy added a newline. This inexact field is superseded by the raw log and this correction.

Alternative A preserves initial metadata and writes a separately bound replacement with the exact quote; it supplies a corrected standalone record but changes future current-path bindings. Alternative B keeps the initial pinned record and explicitly marks this quoted field inexact in an additive correction; it preserves existing handoff/worth input identity while requiring the raw log/correction for the exact text. Root selects B. ROOT-COLLECTION.json and HANDOFF.json remain immutable as reviewed; no source, admission, cap, log, process or original data changes or reruns occur.

The trace body and underlying cause remain unestablished. This copy correction neither diagnoses nor repairs the failed reader and grants no source-data/master/appearance acceptance. The first attempt remains refused and its method closed without retry.
