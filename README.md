# AI-Powered Smart Traffic Management System (Indian Urban Traffic)

An advanced web application prototype and simulation dashboard designed to model and manage traffic flow, camera networks, vehicle registrations, and emergencies across major Indian metropolitan areas: **Delhi, Mumbai, Bengaluru, and Pune**.

This dashboard operates as a unified city operations command center, visualizing simulated telemetry data that mirrors real-world traffic behaviors (such as morning/evening office rushes and rain delays) while providing direct programmatic hooks to swap in real production APIs in the future.

---

## 🚀 Quick Start Instructions

This project is structured as a monorepo workspace to make it easy to start both the frontend and backend with a single terminal command.

### Prerequisites
- Node.js (v18.0.0 or higher)
- npm (v9.0.0 or higher)

### Setup & Run
1. **Clone or navigate to the directory**:
   ```bash
   cd "traffic ai"
   ```

2. **Run the workspace installer**:
   This installs the root dependencies and then runs installations for both `/backend` and `/frontend`.
   ```bash
   npm run setup
   ```

3. **Seed the database**:
   This runs the seeder script to generate initial simulated telemetry logs, coordinates, and vehicle registrations.
   ```bash
   npm run seed
   ```

4. **Launch the development servers**:
   This runs the Express API server (port 5000) and the Vite React app (port 5173) concurrently.
   ```bash
   npm run dev
   ```

5. **Access the application**:
   Open [http://localhost:5173](http://localhost:5173) in your web browser.

---

## 🛠️ Technology Stack

- **Frontend**: React (Vite), Leaflet.js (Interactive Maps & OSM tiles), Recharts (Time-Series Congestion Charts), Lucide React (Dashboard Icons), Vanilla CSS (Custom dark theme visual layout).
- **Backend**: Node.js, Express.js (REST API, background simulation thread).
- **Database**: Custom lightweight JSON database (`backend/src/db/db.json`) wrapped in an ORM-style database controller for easy database swapping.

---

## 📁 Directory Structure

- `/backend`: Express.js server, routers (traffic, vehicles, analytics, incidents), and the background simulation worker.
- `/frontend`: Vite React Single Page Application containing custom widgets (Map, Signals, Registry, Citizen Commuter Portal).
- `/mock-data`: Database seeder script.
- `/docs`: Technical migration guides for connecting Google Traffic Maps, live CCTV camera loops, and VAHAN APIs.
