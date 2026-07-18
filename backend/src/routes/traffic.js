import express from 'express';
import { query, queryOne, run } from '../db/index.js';

const router = express.Router();

// Get all cities with dynamically computed SQLite aggregates
router.get('/cities', (req, res) => {
  try {
    const cities = query('SELECT * FROM cities');
    
    const enrichedCities = cities.map(city => {
      // Calculate average congestion and AQI from roads
      const roadsStats = queryOne(`
        SELECT AVG(congestion_percent) as avg_c, AVG(aqi) as avg_a 
        FROM roads WHERE city_id = ?
      `, [city.id]);
      
      // Calculate active incidents
      const incidentStats = queryOne(`
        SELECT COUNT(*) as active_count 
        FROM incidents WHERE city_id = ? AND status != 'resolved'
      `, [city.id]);
      
      // Calculate total vehicles seen in this city
      const vehicleStats = queryOne(`
        SELECT COUNT(*) as total_v 
        FROM vehicles v
        JOIN cameras c ON v.last_seen_camera = c.id
        WHERE c.city_id = ?
      `, [city.id]);

      return {
        id: city.id,
        name: city.name,
        center: [city.center_lat, city.center_lng],
        avgCongestion: Math.round(roadsStats.avg_c || 0),
        avgAqi: Math.round(roadsStats.avg_a || 0),
        activeIncidents: incidentStats.active_count || 0,
        totalVehicles: vehicleStats.total_v || 0
      };
    });

    res.json(enrichedCities);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Get roads by city (parses polyline JSON string)
router.get('/roads', (req, res) => {
  try {
    const { cityId } = req.query;
    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    const roads = query('SELECT * FROM roads WHERE city_id = ?', [cityId]);
    
    const parsedRoads = roads.map(r => {
      // Fetch active incident IDs for this road
      const activeIncidents = query("SELECT id FROM incidents WHERE road_id = ? AND status != 'resolved'", [r.id]);
      
      return {
        id: r.id,
        cityId: r.city_id,
        name: r.name,
        polyline: JSON.parse(r.polyline),
        congestionPercent: r.congestion_percent,
        congestionLevel: r.congestion_level,
        avgSpeed: r.avg_speed,
        vehicleCount: r.vehicle_count,
        aqi: r.aqi,
        incidentIds: activeIncidents.map(i => i.id)
      };
    });

    res.json(parsedRoads);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch roads' });
  }
});

// Get cameras by city (resolves violations formatting)
router.get('/cameras', (req, res) => {
  try {
    const { cityId } = req.query;
    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    const cameras = query('SELECT * FROM cameras WHERE city_id = ?', [cityId]);
    
    const enrichedCameras = cameras.map(c => {
      const lastViolation = c.last_violation_type ? {
        type: c.last_violation_type,
        time: c.last_violation_time,
        vehicleReg: c.last_violation_reg,
        details: c.last_violation_details
      } : null;

      return {
        id: c.id,
        cityId: c.city_id,
        name: c.name,
        roadId: c.road_id,
        coordinate: [c.lat, c.lng],
        status: c.status,
        liveCount: c.live_count,
        speedLimit: c.speed_limit,
        lastViolation
      };
    });

    res.json(enrichedCameras);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cameras' });
  }
});

// Get signals by city (maps direction lanes)
router.get('/signals', (req, res) => {
  try {
    const { cityId } = req.query;
    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    const signals = query('SELECT * FROM signals WHERE city_id = ?', [cityId]);
    
    const enrichedSignals = signals.map(s => ({
      id: s.id,
      cityId: s.city_id,
      cameraId: s.camera_id,
      junctionName: s.junction_name,
      coordinate: [s.lat, s.lng],
      status: s.status,
      queueLength: s.queue_length,
      waitTime: s.wait_time,
      timingMode: s.timing_mode,
      activePriority: s.active_priority === 1,
      directionQueues: {
        North: s.q_north,
        South: s.q_south,
        East: s.q_east,
        West: s.q_west
      }
    }));

    res.json(enrichedSignals);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch signals' });
  }
});

// Update signal status / manual override
router.put('/signals/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, waitTime, timingMode } = req.body;

    const signal = queryOne('SELECT * FROM signals WHERE id = ?', [id]);
    if (!signal) {
      return res.status(404).json({ error: 'Signal not found' });
    }

    // Prepare update parameters
    const newStatus = status || signal.status;
    const newWait = waitTime !== undefined ? waitTime : signal.wait_time;
    const newMode = timingMode || signal.timing_mode;

    run(`
      UPDATE signals 
      SET status = ?, wait_time = ?, timing_mode = ?
      WHERE id = ?
    `, [newStatus, newWait, newMode, id]);

    // Query enriched updated record
    const updated = queryOne('SELECT * FROM signals WHERE id = ?', [id]);

    // Emit event on socket connection if defined by server main.
    // Real-time changes will broadcast via the global io loop.
    res.json({
      id: updated.id,
      cityId: updated.city_id,
      cameraId: updated.camera_id,
      junctionName: updated.junction_name,
      coordinate: [updated.lat, updated.lng],
      status: updated.status,
      queueLength: updated.queue_length,
      waitTime: updated.wait_time,
      timingMode: updated.timing_mode,
      activePriority: updated.active_priority === 1,
      directionQueues: {
        North: updated.q_north,
        South: updated.q_south,
        East: updated.q_east,
        West: updated.q_west
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update signal' });
  }
});

export default router;
