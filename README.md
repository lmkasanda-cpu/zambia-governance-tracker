# 🇿🇲 Zambia Governance Tracker

**Live civic dashboard tracking Zambia's key economic, governance, social, and democratic indicators.**

> Built for the Zambian public — and the academics, researchers, traders, policy-makers, NGOs, and IGOs who study and serve it.

🌐 **Live site:** [https://[your-username].github.io/zambia-governance-tracker](https://github.com)

---

## What it tracks

| Category | Indicators |
|---|---|
| **Currency** | ZMW/USD, GBP, EUR, ZAR — live rates + 14-year history chart |
| **Copper** | Live LME price, annual production 2010–2024, 2025 projections, 3M tonne roadmap |
| **Other minerals** | Cobalt, nickel, gold, emeralds — production & prices (PwC 2025) |
| **Macroeconomics** | Inflation, GDP growth, GDP per capita, current account |
| **Fiscal** | Budget performance, revenue, deficit, debt/GDP, debt restructuring (92.2% AIP) |
| **Foreign reserves** | USD total + months of import cover (IMF benchmark: ≥3 months) |
| **Governance indices** | CPI (TI), Mo Ibrahim IIAG, Press Freedom (RSF), Democracy (EIU), Rule of Law (WJP), HDI (UNDP) |
| **Demographics** | Population, poverty rate, life expectancy, unemployment |
| **Energy** | ZESCO load-shedding status, electricity access (NEAS 2023), fuel pump prices (ERB) |
| **Agriculture** | Maize production 2017–2026, food security, Strategic Food Reserve |
| **Social sector** | Education & health budgets, Social Cash Transfer, poverty analysis (2026 Budget) |
| **News** | Live RSS from 8+ Zambian and international sources with sentiment tagging |

---

## Data sources

### Live / API
| Data | Source | Refresh |
|---|---|---|
| Exchange rates | [Open Exchange Rates](https://open.er-api.com) | Every 5 min |
| Copper price | Yahoo Finance (HG=F) | On load |
| Macro & social indicators | [World Bank Open Data](https://data.worldbank.org/country/ZM) | On load |
| ZMW/USD annual history | Bank of Zambia (BoZ) | Static |
| News | Daily Mail, Diggers, Daily Nation, Makanday, Lusaka Times, ZNBC, BBC Africa, Reuters Africa | Every 15 min |

### Official documents (hardcoded, dated)
| Data | Source |
|---|---|
| Copper production 2010–2024 | MMMD / PwC Zambia Mining Report 2025 |
| Budget performance 2024 + Q1 2025 | Parliamentary Budget Office, May 2025 |
| Foreign reserves ($4.5B, 4.6 months) | Bank of Zambia / PBO Brief, Q1 2025 |
| Governance indices | TI (2024), RSF (2024), EIU (2023), WJP (2023), UNDP (2023), Mo Ibrahim (2023) |
| Electricity access | Ministry of Energy NEAS 2023 |
| Mining investment, cobalt, nickel, gold, emeralds | PwC Zambia Mining Industry Report 2025 |
| Social sector budgets, poverty 60%, birth registration 14.2% | UNICEF Zambia 2026 Social Sector Budget Analysis |
| Maize production projections | Ministry of Agriculture, May 2026 |
| Eurobond restructuring 92.2% AIP | MoFNP / AfDB, June 2026 |

---

## Running locally

This is a pure static site — no build step, no server required.

```bash
# Clone
git clone https://github.com/[your-username]/zambia-governance-tracker.git
cd zambia-governance-tracker

# Open in browser
open index.html          # macOS
xdg-open index.html      # Linux
start index.html         # Windows
```

Or serve with any static server:
```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## Deploying to GitHub Pages

1. Push this repo to GitHub
2. Go to **Settings → Pages**
3. Set **Source** to `Deploy from a branch`
4. Select **Branch:** `main`, **Folder:** `/ (root)`
5. Click Save — your site will be live at `https://[username].github.io/[repo-name]/`

---

## Contributing

Pull requests welcome. Key areas for contribution:

- **Data updates** — governance indices, budget figures, production data
- **New data sources** — ZamStats API, ZRA reports, BoZ data
- **Translations** — Bemba, Nyanja, Tonga, Lozi
- **Accessibility** — screen reader support, high-contrast mode
- **Mobile** — further responsive improvements

### Data verification policy

All static figures should include a `data-verified` date and source citation. When updating hardcoded data, update the `VERIFIED_DATES` object in `js/app.js` and note the primary source.

---

## Citing this tracker

If you use data from this dashboard in research or publications, please cite the primary sources listed above. This tracker aggregates public data — always verify against original sources for academic or policy purposes.

---

## License

MIT — free to use, adapt, and redistribute with attribution.

---

*Maintained independently. Not affiliated with the Government of the Republic of Zambia, any political party, or any donor organisation.*
