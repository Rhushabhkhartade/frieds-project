# BLOOD AI — AI-Powered Smart Blood Inventory Management Application

An intelligent, web-based hospital blood bank inventory and demand forecasting system. BLOOD AI integrates real-time blood stock monitoring, automated low-stock and critical-deficit detection, shelf-life expiration tracking, and predictive machine learning to preempt blood shortages and eliminate wastage.

---

## 1. Project Purpose

Managing hospital blood bank supplies is critical to patient survival. Traditional inventory methods often suffer from:
- Delayed detection of stockouts for rare blood types (e.g., O-, AB-).
- Blood bag expiration due to lack of enforced First-In, First-Out (FIFO) dispatching.
- Inability to anticipate emergency surgery surges and seasonal trauma spikes.

**BLOOD AI** solves these issues with:
- **Unit-Level Tracking:** Tracks individual blood bags with barcodes, collection dates, and component types (Whole Blood, PRBC, Platelets, Plasma).
- **Proactive Multi-Tier Alerts:** Triggers alerts for Low Stock, Critical Stock, and 7-day expiration thresholds across all 8 standard blood groups.
- **Demand Forecasting:** Estimates blood-unit consumption from recorded ISSUE/USE transactions using a transparent weekday-adjusted statistical provider. The provider interface can connect to a future Python ML service; XGBoost is not included or claimed as currently running.
- **Evidence-Based Recommendations:** Generates deterministic stock, reservation, expiry, and forecast-based guidance from current application data. Suggestions are advisory; the engine does not issue units or assume donor/supplier availability.

---

## 2. Technology Stack

### Frontend (`client/`)
- **Core:** React 18 (SPA) with Vite for instant Hot Module Replacement (HMR).
- **Styling:** Tailwind CSS with a clinical medical theme (deep crimson `#991B1B`, slate `#0F172A`, emerald `#10B981`, amber `#F59E0B`).
- **Routing:** React Router v6.
- **HTTP Client:** Axios with JWT request interceptors and error envelopes.
- **Analytics & Visualizations:** Recharts for time-series demand projections and distribution charts.
- **Iconography:** Lucide React.

### Backend (`server/`)
- **Runtime:** Node.js (v18+ LTS) with Express.js.
- **Architecture:** Layered Controller-Service-Repository pattern.
- **Security & Middlewares:** Helmet, CORS, Morgan HTTP logging, 1MB payload limits.
- **Validation:** Zod schema validation.
- **Data Persistence:** Thread-safe Atomic JSON Storage Adapter (`JsonStorage`) with sequential write-queuing (mutex) and atomic file-swapping.
- **Forecasting:** Provider-based forecast service with a JavaScript statistical provider by default and an opt-in HTTP adapter for a future Python ML service.

---

## 3. Supported Blood Groups

The system natively indexes and models all 8 human ABO/Rh blood groups:
- **`A+`**, **`A-`**
- **`B+`**, **`B-`**
- **`AB+`**, **`AB-`**
- **`O+`**, **`O-`** (Universal Red Cell Donor)

---

## 4. Port Configuration

| Service | Protocol | Default Port | Environment Variable |
|---|---|---|---|
| **Backend REST API** | HTTP | **`5000`** | `PORT=5000` |
| **Frontend Vite SPA** | HTTP | **`5173`** | `VITE_API_BASE_URL=http://localhost:5000/api/v1` |

---

## 5. Installation & Setup

### Prerequisites
- Node.js v18.0.0 or higher
- npm v9.0.0 or higher

### Step 1: Install Dependencies
From the project root:
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### Step 2: Configure Environment Variables
- Backend (`server/.env`):
  ```env
  PORT=5000
  NODE_ENV=development
  JWT_SECRET=blood_ai_dev_secret_key_secure_and_stable_for_local_testing_2026
  JWT_EXPIRES_IN=7d
  DATA_DIR=./data
  ML_SERVICE_URL=http://localhost:5001
  FORECAST_PROVIDER=statistical
  CORS_ORIGIN=http://localhost:5173
  ```
- Frontend (`client/.env`):
  ```env
  VITE_API_BASE_URL=http://localhost:5000/api/v1
  VITE_APP_NAME="BLOOD AI"
  VITE_APP_VERSION=1.0.0
  ```

---

## 6. Running the Application

### Start the Backend Server (Port 5000)
```bash
cd server
npm run dev
# Or production mode: npm start
```
Verify backend health: `http://localhost:5000/health`

### Start the Frontend Client (Port 5173)
```bash
cd client
npm run dev
```
Open in browser: `http://localhost:5173`

---

## 7. Application Routes

- `/login` — Administrator & Staff Login
- `/` — Transfusion Center Dashboard (KPI cards, storage health, group strip)
- `/inventory` — Unit-Level Blood Inventory & FIFO Dispatch
- `/alerts` — Active Critical Deficits & Expiration Alerts
- `/forecasting` — AI Demand Forecast (7d / 14d / 30d projections)
- `/recommendations` — Evidence-Based Inventory Recommendations
- `/reports` — Regulatory Audit Logs & CSV Export
- `/settings` — Blood Group Thresholds & Facility Configuration

### Demand Forecast API

`GET /api/v1/forecast?bloodGroup=O%2B&component=WHOLE_BLOOD&horizon=7&historicalDays=30` requires an authenticated ADMIN or STAFF token. Supported horizons are 1–90 days and history windows are 7–365 days. Only ISSUE and USE transactions contribute to demand; at least three distinct usage dates are required before predictions are returned. Otherwise the API responds with `state: "INSUFFICIENT_DATA"` and does not fabricate forecast points.

The default `FORECAST_PROVIDER=statistical` reports `provider: "statistical"`. Setting `FORECAST_PROVIDER=xgboost` opts into the configured `ML_SERVICE_URL` HTTP adapter (`POST {ML_SERVICE_URL}/forecast`); use that only when an actual compatible model service is deployed.

### Recommendations API

The authenticated ADMIN/STAFF API at `/api/v1/recommendations` lists generated recommendations, `POST /api/v1/recommendations/refresh` re-evaluates current repository data, and `PUT /api/v1/recommendations/:id/status` accepts `ACKNOWLEDGED` or `RESOLVED`. Repeated refreshes update the same active condition rather than creating duplicate cards; cleared triggers resolve automatically and can generate a new record if they recur later.
