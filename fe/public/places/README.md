# Places data

Used by the company form (`src/modules/onboarding/data/regions.ts`).

- `index.json`: countries and their provinces/states, plus attribution.
- `<ISO2>.json`: cities per province, keyed by the province id in `index.json`. Fetched only when that country is picked.

Sources:

- World: [Countries States Cities Database](https://github.com/dr5hn/countries-states-cities-database), ODbL v1.0. Names only, prepared by the sterun project's `scripts/build-places.mjs`.
- Indonesia (`ID` in `index.json` and `ID.json`): official Kemendagri list, Kepmendagri No 300.2.2-2430 Tahun 2025 (38 provinces, 514 regencies and cities), from [cahyadsn/wilayah](https://github.com/cahyadsn/wilayah) (MIT). Province ids are the Kemendagri codes (e.g. `34` = Daerah Istimewa Yogyakarta).
