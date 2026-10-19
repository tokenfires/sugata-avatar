# Runtime inventory guard — preparation worth

**A — one exact preparation correction and one metadata-only inventory attempt are worth doing after root verification.** This is not garment execution or constructor admission.

PLAN:9 permits at most300 module files,150 non-system images,256MiB cumulative reads and64MiB per file. runtime_probe.py:32–40 implements the module cap; :57–62 distinguishes trusted OS/shared-cache paths from pinned non-system images and applies the150 cap. But :47–49 adds an earlier, different limit of300 **total** loaded images before that distinction is made.

The saved f21dbf/exit1 traceback in PROBE-RETURN:8–17 ends exactly at :49. It therefore establishes the extra guard's refusal and no completed inventory. It does not report actual n or the probe PID, and says nothing about whether the150 non-system-image/read caps would pass. RUNTIME.json is absent in this review's direct snapshot. No garment source, geometry or solver was run by this critic.

The proposed change is bounded and decision-relevant: replace only the extra total-count comparison with4096, while preserving the original probe/return and retaining all original module/non-system/per-file/aggregate caps, fixed imports, trusted-host distinction and exclusive output. A finite total-path enumeration ceiling remains; no declared non-system dependency allowance expands. This can reveal whether the selected runtime actually fits the original inventory policy rather than repeat a garment trial or change its numerical budget.

Two alternatives: (1) make precisely that inert source correction, verify the reversible single-literal difference and unchanged caps/import scope, then allow one separately root-owned metadata attempt. This can complete a necessary runtime identity decision but may still refuse at4096 or any original cap; no success is predicted. (2) close executable preparation now with the original refusal/unknown. That avoids a second metadata entry and preserves the failure honestly, while leaving runtime provenance incomplete despite no demonstrated violation of the intended non-system policy. I select(1); there is no fallback, further guard widening or automatic target entry.

Preserve original3897B source and2007B return unchanged. The correction does not qualify loaded images beyond the finite snapshot, all lazy/OS dependencies, future target memory, performance, child retirement or source mathematics. All later executable-source and runtime/resource gates remain required. No METHOD/ARTIST/solver/initializer/candidate/budget, native observer or held constructor may be changed under this decision. A subsequent metadata failure is retained and closes this one correction attempt without rescue.

Only PLAN, the whole original probe and saved return were read; the only absence check was RUNTIME.json. This pair is the critic's sole write. pending_edits=false.
