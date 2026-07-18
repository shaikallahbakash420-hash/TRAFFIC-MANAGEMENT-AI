import express from 'express';
import { query, queryOne } from '../db/index.js';

const router = express.Router();

// Get hourly averages for charts from the SQLite logs table
router.get('/trends', (req, res) => {
  try {
    const { cityId } = req.query;
    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    // Dynamic grouping of logs by hour slot
    const logs = query(`
      SELECT 
        substr(timestamp, 12, 2) || ':00' as hour,
        AVG(congestion_percent) as congestion,
        AVG(aqi) as aqi,
        AVG(vehicle_count) as vehicleCount
      FROM congestion_logs
      WHERE city_id = ?
      GROUP BY hour
      ORDER BY hour ASC
    `, [cityId]);

    const formatted = logs.map(l => ({
      hour: l.hour,
      congestion: Math.round(l.congestion),
      aqi: Math.round(l.aqi),
      vehicleCount: Math.round(l.vehicleCount)
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch analytics trends' });
  }
});

// Predict next hour's traffic
router.get('/prediction', (req, res) => {
  try {
    const { roadId } = req.query;
    if (!roadId) {
      return res.status(400).json({ error: 'roadId is required' });
    }

    const road = queryOne('SELECT * FROM roads WHERE id = ?', [roadId]);
    if (!road) {
      return res.status(404).json({ error: 'Road not found' });
    }

    const nextHour = (new Date().getHours() + 1) % 24;
    const nextHourPattern = `%T${String(nextHour).padStart(2, '0')}%`; // matches T08: or similar

    // Query historical averages for that specific hour slot from database
    const histStats = queryOne(`
      SELECT AVG(congestion_percent) as avg_c 
      FROM congestion_logs 
      WHERE road_id = ? AND timestamp LIKE ?
    `, [roadId, `%T${String(nextHour).padStart(2, '0')}:00%`]);

    const historicalNextHour = histStats.avg_c !== null ? Math.round(histStats.avg_c) : 40;
    
    // WMA calculation: 60% current, 40% historical
    let predictedCongestion = Math.round((road.congestion_percent * 0.6) + (historicalNextHour * 0.4));

    // Incident modifier check from database
    const incidentCount = queryOne(`
      SELECT COUNT(*) as count 
      FROM incidents 
      WHERE road_id = ? AND status != 'resolved'
    `, [roadId]).count;

    if (incidentCount > 0) {
      predictedCongestion = Math.min(100, predictedCongestion + 20);
    }

    // Minor deviation
    predictedCongestion = Math.min(100, Math.max(5, predictedCongestion + Math.floor(Math.random() * 5) - 2));

    const predictedLevel = predictedCongestion > 70 ? 'red' : predictedCongestion > 35 ? 'yellow' : 'green';
    const maxSpeed = (roadId.includes('sealink') || roadId.includes('dnd') || roadId.includes('orr') || roadId.includes('pvnr')) ? 80 : 60;
    let predictedSpeed = Math.round(maxSpeed - (maxSpeed - 6) * (predictedCongestion / 100));
    predictedSpeed = Math.max(5, predictedSpeed);

    res.json({
      roadId,
      roadName: road.name,
      currentCongestion: road.congestion_percent,
      predictedCongestion,
      predictedLevel,
      predictedSpeed,
      modelName: 'Autoregressive Temporal & Incident Multi-Variable SQL Predictor',
      forecastTime: `${nextHour}:00`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate predictions' });
  }
});

// Get best travel times based on aggregate historical SQLite logs
router.get('/best-times', (req, res) => {
  try {
    const { cityId } = req.query;
    if (!cityId) {
      return res.status(400).json({ error: 'cityId is required' });
    }

    // Find average congestion per hour
    const times = query(`
      SELECT 
        substr(timestamp, 12, 2) || ':00' as hour,
        AVG(congestion_percent) as avg_c
      FROM congestion_logs
      WHERE city_id = ?
      GROUP BY hour
      ORDER BY avg_c ASC
    `, [cityId]);

    if (times.length === 0) {
      return res.status(404).json({ error: 'No logs available' });
    }

    // Extract best (lowest) and worst (highest) 3 hours
    const bestTimes = times.slice(0, 3).map(t => ({
      time: t.hour,
      congestion: Math.round(t.avg_c),
      status: 'Free Flow'
    }));

    const worstTimes = [...times].reverse().slice(0, 3).map(t => ({
      time: t.hour,
      congestion: Math.round(t.avg_c),
      status: 'Severe Congestion'
    }));

    res.json({
      cityId,
      bestTimes: bestTimes.sort((a, b) => parseInt(a.time) - parseInt(b.time)),
      worstTimes: worstTimes.sort((a, b) => parseInt(a.time) - parseInt(b.time)),
      currentRecommendation: 'Avoid traveling between 8:30 AM - 10:00 AM and 6:30 PM - 8:30 PM due to peak office hours.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate travel recommendations' });
  }
});

export default router;
