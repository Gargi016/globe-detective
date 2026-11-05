#!/usr/bin/env bash
# Downloads the official CShapes 2.0 (GW system) TopoJSON.
#
# The data file is distributed inside the maintainers' CRAN package "cshapes" 2.0
# (inst/extdata/cshapes_2_gw.topojson.xz). GitHub hosts a read-only mirror of CRAN packages,
# which is what we fetch from. Requires: curl, xz.
#
# Source:  https://github.com/cran/cshapes  (mirror of https://CRAN.R-project.org/package=cshapes)
# Licence: CC BY-NC 4.0 (ETH Research Collection record for the dataset). See NOTICE in public/data/cshapes/.
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p data-raw
URL="https://raw.githubusercontent.com/cran/cshapes/master/inst/extdata/cshapes_2_gw.topojson.xz"

echo "Downloading $URL"
curl -fsSL "$URL" -o data-raw/cshapes_2_gw.topojson.xz
xz -dkf data-raw/cshapes_2_gw.topojson.xz
echo "Wrote data-raw/cshapes_2_gw.topojson ($(wc -c < data-raw/cshapes_2_gw.topojson) bytes)"
