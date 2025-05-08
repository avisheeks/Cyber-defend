# Cybersecurity Threat Detection System

A real-time threat detection system for monitoring and responding to cybersecurity threats.

## Project Structure

- `/backend` - FastAPI application that serves API and WebSocket endpoints
- `/frontend` - React application for visualizing and managing threats

## Getting Started

### Backend Setup

1. Navigate to the backend directory
   ```
   cd backend
   ```

2. Install required packages
   ```
   pip install -r requirements.txt
   ```

3. Start the FastAPI server
   ```
   uvicorn app:app --reload
   ```

### Frontend Setup

1. Navigate to the frontend directory
   ```
   cd frontend
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Start the development server
   ```
   npm start
   ```

## Features

- Real-time threat detection and alerting
- Comprehensive dashboard for threat visualization
- Detailed threat analysis
- Automated and manual threat response
- Historical threat data and analytics

## Technologies Used

- React
- React Router
- Tailwind CSS
- Framer Motion (animations)
- React Icons
- Chart.js (for data visualization)

## Backend API

The application is designed to connect to a backend API that provides threat data. The mock API endpoints expected are:

- `/dashboard/summary` - Dashboard summary statistics
- `/alerts` - List of security alerts
- `/threats/:id` - Details for a specific threat
- `/threat-locations` - Geographical data for threat origins

## Project Structure

```
src/
├── components/         # React components
│   ├── Dashboard.jsx   # Dashboard overview
│   ├── AlertList.jsx   # List of alerts
│   ├── ThreatAnalysis.jsx # Individual threat details
│   ├── ThreatMap.jsx   # Geographical threat visualization
│   └── Settings.jsx    # Application settings
├── App.jsx             # Main application component with routing
├── index.js            # Application entry point
└── index.css           # Global styles and Tailwind imports
```

## Customization

- The UI is built with Tailwind CSS, making it easy to customize colors, spacing, and more.
- The application uses a dark theme by default, optimized for security monitoring.

## License

MIT

## Acknowledgements

- Built using the TON_IoT dataset for realistic threat modeling
- Icons provided by [Phosphor Icons](https://phosphoricons.com/) via react-icons 