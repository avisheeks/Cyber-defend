# Cybersecurity Threat Detection System

![Dashboard Screenshot](frontend/public/images/1.png)
![Threat Visualization](frontend/public/images/2.png)

## Overview

**Cybersecurity Threat Detection System** is a full-stack platform for real-time monitoring, detection, and visualization of cybersecurity threats. It leverages AI/ML models for advanced threat analysis and provides a modern, interactive dashboard for security teams.

---

## Features

- **Real-Time Threat Detection:**
  - Monitors network and system metrics live.
  - Uses AI/ML models to detect anomalies and classify threats.
- **Interactive Dashboard:**
  - Visualizes alerts, system health, and threat analytics.
  - Drill-down analysis for each alert.
- **WebSocket-Powered Updates:**
  - Instant updates to the frontend for new threats and system changes.
- **Customizable & Extensible:**
  - Modular backend and frontend for easy extension.
- **Modern UI/UX:**
  - Built with React, Tailwind CSS, and Framer Motion for a responsive, beautiful interface.

---

## Architecture

```
+-------------------+        WebSocket/REST        +-------------------+
|   Frontend (React)| <------------------------->  |   Backend (FastAPI)|
|  - Dashboard      |                             |  - API & WebSocket |
|  - Visualization  |                             |  - ML Model        |
+-------------------+                             +-------------------+
```

- **Backend:** Python FastAPI, ML model (see `backend/ml_model.py`), real-time WebSocket endpoints.
- **Frontend:** React, Tailwind CSS, Chart.js, Framer Motion, real-time data via WebSocket.

---

## Quick Start

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd frontend
npm install
npm start
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8001

---

## Directory Structure

```
.
├── backend/                # FastAPI backend, ML model
│   ├── app.py              # Main API and WebSocket server
│   ├── ml_model.py         # Threat detection model logic
│   └── requirements.txt    # Python dependencies
├── frontend/               # React frontend
│   ├── src/                # React source code
│   ├── public/images/      # Dashboard and threat images
│   └── ...
├── models/                 # ML model files
│   ├── windows10_threat_detector.lgb
│   ├── windows10_threat_detector_scaler.pkl
│   └── ...
└── ...
```

---

## Example Screenshots

### Dashboard
![Dashboard](frontend/public/images/1.png)

### Threat Visualization
![Threat Visualization](frontend/public/images/2.png)

---

## Customization & Extensibility
- **Add new ML models:** Place in `models/` and update `ml_model.py`.
- **Extend frontend:** Add new React components in `frontend/src/components/`.
- **API:** Add new endpoints in `backend/app.py`.

---

## License
MIT

---

## Credits
- Dashboard and threat images: see `frontend/public/images/`
- Built with FastAPI, React, Tailwind CSS, Chart.js, and Framer Motion. 