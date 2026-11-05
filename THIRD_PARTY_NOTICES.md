# Third-party notices

Globe Detective includes or depends on the following. This file is a good-faith summary, not legal advice;
check each source for the current terms.

## Data

| Material | Where | Licence / terms |
| --- | --- | --- |
| **CShapes 2.0** – Schvitz, G., Girardin, L., Rüegger, S., Weidmann, N. B., Cederman, L.-E., & Gleditsch, K. S. (2022). *Mapping the International System, 1886–2019: The CShapes 2.0 Dataset.* Journal of Conflict Resolution, 66(1), 144–161. https://doi.org/10.1177/00220027211013563 | `public/data/cshapes/` (simplified derivative; see `public/data/cshapes/NOTICE.txt`) | The ETH Research Collection record lists **CC BY-NC 4.0**; an earlier review of the project page recorded CC BY-NC-SA 4.0. This project applies the stricter **CC BY-NC-SA 4.0**: attribution, **non-commercial use only**, share-alike for adaptations. Project page: https://icr.ethz.ch/data/cshapes/ |
| **Natural Earth** 1:110m countries, via the `world-atlas` package | `public/data/countries-110m.json` | Natural Earth: public domain. `world-atlas`: ISC. Contains curated geometry correction along the shared Indo-Bhutanese border (Arc 399) restoring Tawang within India without Douglas–Peucker diagonal distortion. |
| **Earth imagery** (`earth-blue-marble.jpg`) and relief map (`earth-topology.png`) | `public/img/` (copied from the `three-globe` package's `example/img`) | Distributed with `three-globe` (MIT). The imagery appears to be NASA Blue Marble material, which NASA generally publishes without copyright restriction; the package does not state the provenance, so verify before any commercial use. |
| Historical event, name and clue tables | `src/detective/historicalEvents.ts`, `src/history/nameHistory.ts`, `src/history/examples.ts` | Written for this project, citing the reference links stored beside each entry. |
| Territorial accuracy & disputed area notes | `src/history/datasetNotes.ts`, `src/history/sources.ts` | Contextual notes documenting de facto control vs international recognition and competing claims across Kashmir, Taiwan, Crimea, Palestine, Western Sahara, and Cyprus, citing UN resolutions (UNMOGIP, UNSC Res 242/541, UN GA Res 2758/6719/68262) and bilateral treaties (Simla Agreement 1972). |

**Consequence:** because CShapes is non-commercial, deployments of this app must be non-commercial (no ads, paywall or paid plan built on it).

## Software (runtime dependencies)

| Package | Version | Licence |
| --- | --- | --- |
| react, react-dom | 19.x | MIT |
| three | 0.187 | MIT |
| react-globe.gl (and globe.gl / three-globe) | 2.38 | MIT |
| d3-geo | 3.x | ISC |
| topojson-client | 3.x | ISC |
| world-atlas | 2.x | ISC |

Build and test tools (Vite, TypeScript, Vitest, tsx, mapshaper, topojson-simplify, axe-core) are development-only and are not shipped in the built site.

## Fonts

Cormorant Garamond and Inter are loaded from Google Fonts (SIL Open Font License 1.1). If the request is blocked, the app falls back to system serif and sans-serif fonts.
