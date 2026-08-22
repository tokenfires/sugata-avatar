#!/bin/zsh
set -e
S=/private/tmp/claude-501/-Users-robault-Documents-GitHub-Sugata--/c30a31f2-1ae9-40e1-a56a-b9fda16bdd36/scratchpad
F=$S/frostbitten-hair-webgpu
P=sugata-bob01_g050
GROOMS="floor16=$P.floor16.16points.tfx,\
bob496=$P.d1.reg.16points.tfx,\
bob992=$P.d2.reg.16points.tfx,\
bob2480=$P.d5.reg.16points.tfx,\
bob4960=$P.d10.reg.16points.tfx,\
bob11408=$P.d23.reg.16points.tfx,\
bob24800=$P.d50.reg.16points.tfx,\
sintel11400=SintelHairOriginal-sintel_hair.16points.tfx,\
strat496=$P.strat496.16points.tfx,\
strat992=$P.strat992.16points.tfx,\
strat2480=$P.strat2480.16points.tfx,\
strat4960=$P.strat4960.16points.tfx"
ARMS='0:1:100,0:0:100,1:0:100,3:0:100,0:0:0,3:0:0'
EXTRA='bob11408|0:0:4.34344,bob11408|0:0:8.69127,bob11408|0:0:21.73475,bob11408|0:0:43.47388'
W=$1; H=$2; OUT=$3
cd $F
DENO_NO_PACKAGE_JSON=1 GROOMS="$GROOMS" ARMS="$ARMS" EXTRA="$EXTRA" \
  WARMUP=4 BATCH=40 REPEATS=7 W=$W H=$H \
  deno run --allow-read=. --allow-write=. --allow-env --unstable-webgpu src/index.ladder.ts > "$OUT.raw" 2>"$OUT.stderr"
tail -1 "$OUT.raw" > "$OUT"
python3 -c "import json;json.load(open('$OUT'))" && echo "OK $OUT"
