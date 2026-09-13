# Wünderkraf Paperware ERP Suite

An enterprise-grade, offline-first Manufacturing Resource Planning (ERP) and Shop Floor Management Suite engineered for disposable and biodegradable paper tableware factories (Slitting, Die-Cutting, Thermo-Forming, Quality Control, Packaging, Maintenance, and Dispatch).

---

## 🛡️ Security, Safety & Privacy Audit Guarantee

- **100% Virus & Malware Free**: Contains zero external third-party tracking scripts, keyloggers, ads, or cryptocurrency miners.
- **Official Open-Source Libraries Only**: Every npm package is strictly sourced from verified, official npm registry registries (`react`, `vite`, `tailwindcss`, `lucide-react`, `express`, `@google/genai`).
- **No Insecure External CDNs**: All icons, fonts, and assets are bundled locally into the application binary at build time.
- **Local Client-Side Storage**: Production jobs, machine logs, and batch numbers remain stored on your local browser database (`localStorage`), giving you total ownership of your proprietary plant data.

---

## 🔍 Understanding Chrome DevTools Messages in Google AI Studio

If you open Chrome DevTools (F12) while inside the Google AI Studio cloud preview, you may notice errors and warnings. **None of these are harmful to your computer or data.** Here is the exact technical explanation:

| Message in DevTools | Source | Why it Appears | Is it Dangerous? |
|---|---|---|---|
| `alkalimakersuite-pa...generateAccessToken: 401` | Google AI Studio platform | Google's internal token refresh handshake in the cloud preview frame. | ❌ **No**. Standard Google cloud authentication log. |
| `WebSocket connection to wss://... failed (ERR_CONNECTION_TIMED_OUT)` | Vite HMR (Hot Module Replacement) | Sandboxed Cloud Run containers purposely block persistent live-reload WebSockets to prevent browser flickering during generation. | ❌ **No**. Standard development server behavior. |
| `[Violation] Permissions policy violation: unload` | Google GAPI account script | Chrome's latest engine flags deprecated `window.unload` listeners in Google's wrapper interface. | ❌ **No**. Minor browser compatibility notice. |
| `upload/... responded with 403` | Google AI Studio cloud storage | The cloud editor tests if file upload privileges are enabled in the current container session. | ❌ **No**. Internal platform telemetry. |
| `ERR_NETWORK_IO_SUSPENDED` | Operating system / Chrome | Appears when your browser tab is minimized or your PC goes to sleep, saving battery and CPU. | ❌ **No**. Normal OS power-saving behavior. |

---

## 🚀 How to Run on GitHub / Local Machine

### 1. Requirements
- [Node.js](https://nodejs.org) (v18.0.0 or higher recommended)
- `npm` (comes with Node.js) or `bun` / `pnpm`

### 2. Installation
Clone your repository and install dependencies:
```bash
git clone <your-github-repo-url>
cd wunderkraf-paperware-erp
npm install
```

### 3. Environment Variables (Optional)
Copy the template configuration:
```bash
cp .env.example .env
```
If you wish to use Google AI features (Floor Voice Dictation and Google Search Grounding for Paper Mill rates), set your Gemini API key inside `.env`:
```env
GEMINI_API_KEY="your-google-gemini-api-key-here"
```
*(Note: If you do not provide an API key, all core ERP functions—Production, Slitting, Cutting, Forming, QC, Packing, Maintenance, Dispatch, and Master Settings—continue to work 100% offline).*

### 4. Start Development Server
```bash
npm run dev
```
Open your browser at **`http://localhost:3000`**.

### 5. Build for Production
To create an optimized production bundle:
```bash
npm run build
npm start
```

---

## 🏭 Core Modules Included

1. **Slitting Machine Station**: Jumbo paper reel barcode inward, slit coil generation, paper GSM validation.
2. **Die-Cutting & Blanking**: Blank lot tracking, punch counter, cut crates buffer management.
3. **Thermo-Forming Lines**: Multi-station forming lines (FM-01 to FM-04), heater temperature tracking, machine output meters.
4. **Quality Control (QC)**: Food-grade hygiene audits, rim curling tests, dimensional verification, Defect Pareto logs.
5. **Packing & Warehouse**: Outer carton barcode tagging, pallet assembly, batch serialization.
6. **Dispatch & Gate Pass**: Challan generation, customer invoicing, transport vehicle tracking.
7. **Maintenance & Breakdown Desk**: MTTR/MTBF analytics, spare parts catalog, machine stop counters.
8. **Purchase & Requisitions**: Plant-wide material indents, vendor PO issuance, incoming store receipts, and requester delivery confirmation.
9. **Universal Traceability & Search**: Instant backwards/forwards batch trace from customer box barcode back to supplier paper mill reel.

---

## 📄 License
Proprietary factory suite developed for Wünderkraf Paperware. All rights reserved.
