# Production Integration Guide: Traffic AI System

This guide outlines the system architecture and provides step-by-step instructions on how to transition this prototype to production-grade live services, swapping mock components with real integrations.

## 1. System Architecture Overview

The system is structured as an decoupled, event-ready REST service:
```
                                +-------------------+
                                |  React Frontend   |
                                +---------+---------+
                                          |
                                          | JSON REST APIs (Polling)
                                          v
                                +---------+---------+
                                |  Express Backend  |
+-------------------+           +---------+---------+
|  Real-Time        |                     |
|  Simulator        | <===================> (Read/Write JSON DB Client)
+-------------------+                     |
                                          v
                                +---------+---------+
                                |   db.json File    |
                                +-------------------+
```

To replace components, you will override specific modules in the `backend/src/db/` or `backend/src/routes/` directories, maintaining the existing API contracts.

---

## 2. Replacing the Mock Database

Currently, `backend/src/db/index.js` acts as a synchronous JSON-file ORM. To swap this with PostgreSQL or MongoDB:

1. Install your database driver (e.g., `pg` or `mongoose`).
2. Rewrite `backend/src/db/index.js` to export a database pool or connection instance.
3. Update database methods in routes to use async SQL queries:

```javascript
// Example: Swapping in Postgres (pg) in backend/src/db/index.js
import pg from 'pg';
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = {
  get: async (table) => {
    const res = await pool.query(`SELECT * FROM ${table}`);
    return res.rows;
  },
  find: async (table, id) => {
    const res = await pool.query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return res.rows[0];
  },
  update: async (table, id, data) => {
    // Generate dynamic SQL UPDATE string...
  }
};
```

---

## 3. Integrating Live Traffic Maps (Google Maps / Mapbox)

The Leaflet map in `frontend/src/components/TrafficMap.jsx` uses open-source OpenStreetMap tiles. To display real-time traffic details in production:

### Option A: Google Maps Traffic Layer
Replace Leaflet with the Google Maps Javascript API, and append the `TrafficLayer`:

```javascript
// In frontend src/components/TrafficMap.jsx
import { useEffect, useRef } from 'react';

export default function TrafficMap({ selectedCity }) {
  const mapRef = useRef(null);

  useEffect(() => {
    const map = new window.google.maps.Map(mapRef.current, {
      zoom: 13,
      center: { lat: 12.9716, lng: 77.5946 }, // Bengaluru
    });

    const trafficLayer = new window.google.maps.TrafficLayer();
    trafficLayer.setMap(map);
  }, []);

  return <div ref={mapRef} style={{ width: '100%', height: '500px' }} />;
}
```

### Option B: Mapbox Traffic V2
If continuing with Leaflet, you can swap the tile layer URL with Mapbox's vector traffic tiles using your Mapbox access token:
`https://api.mapbox.com/styles/v1/mapbox/navigation-guidance-night-v4/tiles/...`

---

## 4. Hooking Live Smart City Cameras & Computer Vision (YOLO)

In the prototype, `TrafficMap.jsx` plays an SVG animation showing mock detections. To display actual camera feeds with live AI vehicle counting:

1. **Camera Feed RTMP/HLS Source**: Integrate video feeds from authorized Smart City portals (e.g., Bengaluru Safe City Project). Render these streams using an HLS player like `video.js` instead of the SVG placeholder.
2. **YOLOv8 Inference Pipeline**: Feed the RTSP stream into an edge inference server running YOLOv8. The server runs object detection, categories frames (e.g., `car`, `bike`, `bus`), and publishes count payloads to a message broker (RabbitMQ/Kafka).
3. **Backend Broker Consumer**: Create a backend service that listens to the queue and updates the databases:

```javascript
// Example: Processing live YOLO counts in backend
import amqp from 'amqp-connection-manager';

const connection = amqp.connect(['amqp://localhost']);
const channel = connection.createChannel({
  json: true,
  setup: (channel) => {
    return Promise.all([
      channel.assertQueue('yolo_counts', { durable: true }),
      channel.consume('yolo_counts', (msg) => {
        const { cameraId, count, breakdown } = msg.content;
        // Update database with real camera telemetry
        db.update('cameras', c => c.id === cameraId, {
          liveCount: count,
          vehicleBreakdown: breakdown
        });
        channel.ack(msg);
      })
    ]);
  }
});
```

---

## 5. Integrating Government VAHAN Vehicle Database

To replace mock vehicle registration searches with real RTO and VAHAN profiles:

1. Procure authorized API credentials for the National Informatics Centre (NIC) VAHAN API.
2. Replace the query database routine in `backend/src/routes/vehicles.js` with an external HTTP request:

```javascript
// In backend/src/routes/vehicles.js
import axios from 'axios';

router.get('/:regNumber', async (req, res) => {
  const { regNumber } = req.params;
  try {
    const vahanResponse = await axios.get('https://vahan.nic.in/api/v1/vehicle', {
      params: { reg_no: regNumber },
      headers: { 'Authorization': `Bearer ${process.env.VAHAN_API_KEY}` }
    });
    
    // Parse official data (Owner Name, Chassis No, Fuel, Fitment, Insurance status)
    const vehicle = {
      regNumber: vahanResponse.data.rc_reg_no,
      owner: vahanResponse.data.rc_owner_name,
      type: vahanResponse.data.rc_vh_class_desc,
      fuelType: vahanResponse.data.rc_fuel_desc,
      flagged: vahanResponse.data.blacklisted === 'Y',
      expiredDocuments: vahanResponse.data.fit_upto_expired ? ['PUC', 'Fitness'] : []
    };
    
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'VAHAN registry search failed' });
  }
});
```

---

## 6. Smart Signals and SCATS Automation

For real-time traffic signal automation in adaptive mode, swap the randomized timer logic inside `backend/src/services/simulator.js` with requests to the city's SCATS (Sydney Coordinated Adaptive Traffic System) control server or regional signal control boards, sending override packets when emergency corridors are active.
