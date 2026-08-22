#!/bin/zsh
set -e
S=/private/tmp/claude-501/-Users-robault-Documents-GitHub-Sugata--/c30a31f2-1ae9-40e1-a56a-b9fda16bdd36/scratchpad
F=$S/frostbitten-hair-webgpu
P=sugata-bob01_g050
OUTD=$S/ladder/plates
mkdir -p $OUTD
cd $F
render() { # $1=file $2=tag $3=az $4=cx $5=cz $6=yaw $7=key(0|1)
  local extra=""
  if [[ $7 == 1 ]]; then extra="HR0=0 HG0=255 HB0=0 HR1=0 HG1=255 HB1=0"; fi
  env DENO_NO_PACKAGE_JSON=1 HAIR=$1 MODE=0 CX=$4 CY=1.47 CZ=$5 YAW=$6 \
      $(echo $extra) OUT=$OUTD/$2.png \
      deno run --allow-read=. --allow-write=/ --allow-env --unstable-webgpu src/index.plate.ts >/dev/null 2>&1
}
declare -A F2N
FILES=("$P.floor16.16points.tfx:00016" "$P.d1.reg.16points.tfx:00496" "$P.d2.reg.16points.tfx:00992" "$P.d5.reg.16points.tfx:02480" "$P.d10.reg.16points.tfx:04960" "$P.d23.reg.16points.tfx:11408" "$P.d50.reg.16points.tfx:24800")
VIEWS=("az00:0.0:1.07:0.0" "az40:0.68779:0.81966:-0.69813" "az90:1.07:0.0:-1.5708")
for f in $FILES; do
  file=${f%%:*}; n=${f##*:}
  for v in $VIEWS; do
    parts=(${(s/:/)v}); az=$parts[1]; cx=$parts[2]; cz=$parts[3]; yaw=$parts[4]
    render $file "beauty-$n-$az" $az $cx $cz $yaw 0
    render $file "key-$n-$az"    $az $cx $cz $yaw 1
    echo "  $n $az"
  done
done
