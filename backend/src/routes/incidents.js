import express from 'express';
import { query, queryOne, run, transaction } from '../db/index.js';

const router = express.Router();

// Get incidents by city
router.get('/', (req, res) => {
  try {
    const { cityId } = req.query;
    let rows;
    if (cityId) {
      rows = query(`
        SELECT i.*, r.name as road_name 
        FROM incidents i
        JOIN roads r ON i.road_id = r.id
        WHERE i.city_id = ?
        ORDER BY 
          CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END,
          i.reported_time DESC
      `, [cityId]);
    } else {
      rows = query(`
        SELECT i.*, r.name as road_name 
        FROM incidents i
        JOIN roads r ON i.road_id = r.id
        ORDER BY 
          CASE WHEN i.status = 'resolved' THEN 1 ELSE 0 END,
          i.reported_time DESC
      `);
    }

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// Report incident in database & spike road congestion
router.post('/', (req, res) => {
  try {
    const { cityId, roadId, type, description, severity } = req.body;
    
    if (!cityId || !roadId || !type || !description || !severity) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const road = queryOne('SELECT * FROM roads WHERE id = ?', [roadId]);
    if (!road) {
      return res.status(404).json({ error: 'Road not found' });
    }

    const newId = `inc_${Date.now()}`;
    const reportTime = new Date().toISOString();

    // Use transaction to insert incident and update road congestion
    transaction(() => {
      run(`
        INSERT INTO incidents (id, city_id, road_id, type, description, severity, reported_time, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [newId, cityId, roadId, type, description, severity, reportTime, 'reported']);

      // Spike congestion on this road
      run(`
        UPDATE roads 
        SET congestion_percent = MIN(100, congestion_percent + 25),
            congestion_level = 'red'
        WHERE id = ?
      `, [roadId]);
    });

    res.status(201).json({
      id: newId,
      cityId,
      roadId,
      type,
      description,
      severity,
      reportedTime: reportTime,
      status: 'reported'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to report incident' });
  }
});

// Update incident status
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // reported, resolving, resolved

    const incident = queryOne('SELECT * FROM incidents WHERE id = ?', [id]);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    run('UPDATE incidents SET status = ? WHERE id = ?', [status, id]);

    res.json({ ...incident, status });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// Trigger Emergency Corridor using Relational Joins
router.post('/emergency/corridor', (req, res) => {
  try {
    const { cityId, roadIds, vehicleType, regNumber } = req.body;

    if (!cityId || !roadIds || !Array.isArray(roadIds) || roadIds.length === 0) {
      return res.status(400).json({ error: 'Missing cityId or roadIds array' });
    }

    // SQLite join query to locate signals corresponding to cameras along the chosen route
    const placeholders = roadIds.map(() => '?').join(',');
    const matchingSignals = query(`
      SELECT s.id, s.junction_name
      FROM signals s
      JOIN cameras c ON s.camera_id = c.id
      WHERE c.road_id IN (${placeholders}) AND s.city_id = ?
    `, [...roadIds, cityId]);

    const overriddenSignalIds = matchingSignals.map(s => s.id);

    if (overriddenSignalIds.length === 0) {
      // Fallback: If no matching signal, override the first signal in the city
      const fallback = queryOne('SELECT id FROM signals WHERE city_id = ? LIMIT 1', [cityId]);
      if (fallback) overriddenSignalIds.push(fallback.id);
    }

    if (overriddenSignalIds.length > 0) {
      transaction(() => {
        overriddenSignalIds.forEach(id => {
          run(`
            UPDATE signals 
            SET status = 'GREEN', wait_time = 60, active_priority = 1, timing_mode = 'manual'
            WHERE id = ?
          `, [id]);
        });
      });
    }

    res.json({
      success: true,
      message: 'Emergency Corridor established successfully',
      overriddenSignals: overriddenSignalIds
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to establish emergency corridor' });
  }
});

// Release Emergency Corridor
router.post('/emergency/release', (req, res) => {
  try {
    const { cityId } = req.body;
    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    run(`
      UPDATE signals 
      SET active_priority = 0, timing_mode = 'adaptive', wait_time = 10 
      WHERE city_id = ? AND active_priority = 1
    `, [cityId]);

    res.json({ success: true, message: 'Emergency Corridor released and returned to adaptive control.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to release emergency corridor' });
  }
});

export default router;
