# Third-party parts

Everything here is open source and ships inside the app (no server, no download at run time).

| Part | What it does | Licence |
|---|---|---|
| [pdf-lib](https://github.com/Hopding/pdf-lib) | Builds, joins, splits and rewrites PDFs in the browser | MIT |
| [Material Symbols](https://github.com/google/material-design-icons) (Rounded) | The icons, baked in as inline SVG paths by `web/scripts/fetch-icons.mjs` | Apache License 2.0 |

Training data and models are covered separately (see `docs/ML_EVALUATION.md`). Only data with a licence that allows
redistribution may be used for a model that ships; research-only datasets are used for measuring, never for the shipped model.
