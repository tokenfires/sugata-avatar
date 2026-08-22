captures/hair-r31-separation — the three-arm separation of GROOM from RENDERER.

  A. our groom  x OUR renderer     captures/hair-r24-before/            pre-existing, NOT re-rendered
  B. our groom  x THEIR renderer   arm-b/                               NEW, this is the separator
  C. their groom x THEIR renderer  captures/control-frostbitten/        pre-existing, NOT re-rendered
     + arm-c-companion/            NEW: C at arm B's exact two cameras

A vs B swaps the RENDERER with the groom held fixed. B vs C swaps the GROOM with the renderer
held fixed. A complaint that survives into B belongs to the guide curves; a complaint that dies
in B was being made by the card / alpha / dither path.

HOW ARM B WAS MADE
  strands  tools/figure-pipeline/tfx_export.py --hair bob01 --gender 0.5 --strand-density 23
           -> 11,408 strands x 16 points. Density 23 and not 1, because arm C is 11,400 strands:
           at density 1 the arm would differ from C in COUNT as well as in SHAPE, and count is
           not what is on trial. arm-b-d1/ is the same groom at 496 strands — one strand per card
           of the shipping groom — and is supplementary, not the judged arm.
  scale    --tfx-scale 1.0. MEASURED, not guessed: the two grooms' ROOT clouds have RMS radii
           0.0904 m (ours) and 0.0864 m (theirs), agreeing to 4.6%, and both sit at head height
           in the same frame (our y 1.324-1.688, theirs 1.396-1.675). The uniform scale that
           would match the RMS radii exactly is 0.95654; 1.0 is inside the measurement and keeps
           our groom in its own metres, which is what "our groom" means.
  registration
           a rigid translation of (+0.00161, -0.01803, -0.03996) m, which puts our root centroid
           on theirs. Our scalp otherwise floats 3.2 cm above Sintel's skull and the strands pass
           through her face. tfx_xform.py does it and re-measures every strand's arc length after:
           max change 1.04e-8 m, i.e. float32 noise. NO SHAPE TERM. No rotation: a 180-degree yaw
           was tried and rejected — it hides the fringe, which is the front of our groom and is
           present in arm A too.
  fiber    fiberRadius left at the author's 0.0006. NOT a departure. It is the right call here
           precisely because the strand COUNT was matched to theirs; the knob is exposed in
           index.armb.ts (FIBER=) so the choice is visible rather than implicit.
  cameras  portrait      CX=0     CY=1.47 CZ=1.07     YAW=0         PITCH=0 FOV=30
           three-quarter CX=0.613727 CY=1.47 CZ=0.876493 YAW=-0.610865 PITCH=0 FOV=30
           The portrait camera is arm C's own, RECOVERED by re-rendering: it reproduces
           captures/control-frostbitten/portrait.png at 0.276% changed pixels, mean |dR| 0.0078
           of one code value. The three-quarter is that camera orbited 35 degrees with re-aim,
           35 being arm A's manifest's own azimuthDegrees.
  colour   the README's neutral brown, col(59,38,27) root / col(92,63,44) tip, NOT our #1A0E0C.
           control-frostbitten/README.md forbids matching our own albedo and the README wins:
           B and C then differ only in the groom.
  entrypoint index.armb.ts (archived here) = index.control.ts plus three env knobs and nothing
           else. Lights, shadows, AO, lobe weights, roughness, tonemap and the solved background
           are the author's, untouched. frostbitten is NOT vendored; the clone is a scratchpad
           working copy at upstream 4478dd1 with the two documented Deno-2 patches plus our five
           filenames added to the `HairFile` union in src/constants.ts.

BACKGROUND, CONFIRMED BY PIXEL READ AT ALL FOUR CORNERS
  arm-b, arm-b-d1, arm-c-companion, control-frostbitten   RGB(20,22,26) x4
  hair-r24-before (arm A)                                 RGB(2,3,4) top, SKIN bottom

  🚩 ARM A IS NOT ON THE SAME BACKDROP OR THE SAME FRAMING AS ARMS B AND C. It is a tight bust on
  near-black; B and C are mid-shots on (20,22,26). That is how the 8/14 plates shipped and it is
  NOT repaired here, because re-rendering arm A would substitute a fresh plate for the one six
  judges actually saw. A-vs-B is therefore confounded by backdrop and framing. B-vs-C is clean.

WHAT IS NOT HERE
  ⚠️ Arm C's THREE-QUARTER camera was not recovered. Roughly 400 renders of grid, random and
  coordinate-descent search over CX/CY/CZ/YAW/PITCH/FOV floored at mean |dR| 10.77 of 255 against
  captures/control-frostbitten/tq.png, against 0.0078 for the portrait. The whole-frame metric is
  also actively misleading here — it is dominated by the bright body and its minimum sits at a
  visibly WRONG azimuth. arm-c-companion/ exists because of this: it is their groom at arm B's
  cameras, so the matched B-vs-C pair is available without touching the 8/14 plates. Verified
  against the original on the portrait, where the cameras do agree: the strand-frequency
  statistic reads 17.83 vs 17.80 on the identical box.

  ⚠️ No judge has been run. separation-blind.mjs has built the three-arm blind tree under blind/
  with the key at blind-KEY.json (a sibling, outside the judged tree) and JUDGE-PROMPT.md carries
  the prompt, the evidence rules and the computed decoy table. Dispatch needs an agent that can
  spawn subagents; this one cannot.
