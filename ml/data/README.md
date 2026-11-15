# ml/data — sources

Raw files go in `raw/` exactly as downloaded, with the download date in the
file name. `raw/` and `processed/` are gitignored.

| File (expected) | Source | How to get it | Status |
|---|---|---|---|
| `raw/faostat_qcl_<date>.zip` | FAOSTAT bulk "Production_Crops_Livestock_E_All_Data_(Normalized)" | Direct download, no key (33.9 MB) | Verified reachable; Türkiye has national yields only |
| `raw/tuik_bitkisel_uretim_ilce_<date>.csv` | TÜİK MEDAS, Bitkisel Üretim İstatistikleri, district level | Manual export from biruni.tuik.gov.tr/medas (steps in `docs/ml/dataset-audit.md` §7) | **Not yet exported** |

Do not add synthetic or hand-made rows to these tables. Test fixtures that
mimic data live next to the tests in `src/` and are labelled as synthetic.
