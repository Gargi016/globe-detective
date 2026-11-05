Files from an earlier, partial Phase 3 attempt, moved here (not deleted) so they are neither served nor shipped.

  build-history.mjs, cshapes-gw.topo.json, meta.json

They were made from the same upstream CShapes file as the current pipeline (identical SHA-256
9f73468b...c3bc), but their simplified geometry has self-intersections, including ~1.4 million km2
loops in Egypt's polygons, so the app uses the output of scripts/build-history-data.mjs instead.
The provenance layer from that attempt (src/history/sources.ts, nameHistory.ts, datasetNotes.ts)
IS used by the app.
