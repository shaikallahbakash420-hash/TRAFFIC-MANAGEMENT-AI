import { query, queryOne, run, transaction } from '../db/index.js';

const MAX_QUEUE_LIMIT = 25; 
const RANDOM_VIOLATION_CHANCE = 0.20; 

const violationTypes = ['Overspeeding', 'Wrong-side Driving', 'Signal Jumping'];

// Shared in-memory list for operational feed alerts
export let systemLogs = [
  { timestamp: new Date().toISOString(), message: 'Smart Traffic Management SQLite Engine Online', type: 'system', cityId: 'bengaluru' }
];

export function startSimulation(io) {
  console.log('Real-time SQLite simulation engine started.');

  setInterval(() => {
    try {
      // 1. Simulate Roads
      simulateRoads();

      // 2. Simulate Signals
      simulateSignals(io);

      // 3. Simulate Camera Violations
      simulateCameras();

      // 4. Clean old logs (older than 24 hours)
      const pruneDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      run('DELETE FROM congestion_logs WHERE timestamp < ?', [pruneDate]);

      // 5. Broadcast to connected clients
      broadcastTrafficUpdate(io);

    } catch (error) {
      console.error('Error in simulation tick:', error);
    }
  }, 5000); // 5s interval
}

function broadcastTrafficUpdate(io) {
  if (!io) return;
  try {
    const roads = query('SELECT * FROM roads');
    const cameras = query('SELECT * FROM cameras');
    const signals = query('SELECT * FROM signals');
    const incidents = query("SELECT * FROM incidents WHERE status != 'resolved'");

    const formattedRoads = roads.map(r => ({
      id: r.id,
      cityId: r.city_id,
      name: r.name,
      polyline: JSON.parse(r.polyline),
      congestionPercent: r.congestion_percent,
      congestionLevel: r.congestion_level,
      avgSpeed: r.avg_speed,
      vehicleCount: r.vehicle_count,
      aqi: r.aqi,
      incidentIds: query("SELECT id FROM incidents WHERE road_id = ? AND status != 'resolved'", [r.id]).map(i => i.id)
    }));

    const formattedCameras = cameras.map(c => ({
      id: c.id,
      cityId: c.city_id,
      name: c.name,
      roadId: c.road_id,
      coordinate: [c.lat, c.lng],
      status: c.status,
      liveCount: c.live_count,
      speedLimit: c.speed_limit,
      lastViolation: c.last_violation_type ? {
        type: c.last_violation_type,
        time: c.last_violation_time,
        vehicleReg: c.last_violation_reg,
        details: c.last_violation_details
      } : null
    }));

    const formattedSignals = signals.map(s => ({
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

    io.emit('traffic_update', {
      roads: formattedRoads,
      cameras: formattedCameras,
      signals: formattedSignals,
      incidents,
      logs: systemLogs.slice(0, 50)
    });
  } catch (error) {
    console.error('Failed to emit WebSocket update:', error);
  }
}

function simulateRoads() {
  const roads = query('SELECT * FROM roads');
  const nowStr = new Date().toISOString();

  transaction(() => {
    roads.forEach(road => {
      // Fluctuate count
      let change = Math.floor(Math.random() * 9) - 4; // -4 to +4
      let count = Math.max(10, road.vehicle_count + change);
      
      const maxCap = 200;
      let congestionPercent = Math.min(100, Math.round((count / maxCap) * 100));

      // Higher congestion if active incident on road
      const incidentCount = queryOne("SELECT COUNT(*) as count FROM incidents WHERE road_id = ? AND status != 'resolved'", [road.id]).count;
      if (incidentCount > 0) {
        congestionPercent = Math.min(100, congestionPercent + 25);
      }

      let congestionLevel = 'green';
      if (congestionPercent > 70) congestionLevel = 'red';
      else if (congestionPercent > 35) congestionLevel = 'yellow';

      const maxSpeed = (road.id.includes('sealink') || road.id.includes('dnd') || road.id.includes('orr') || road.id.includes('pvnr')) ? 80 : 60;
      let avgSpeed = Math.round(maxSpeed - (maxSpeed - 6) * (congestionPercent / 100));
      avgSpeed = Math.max(5, avgSpeed);

      let aqi = Math.round(50 + (congestionPercent / 100) * 320 + Math.random() * 15);
      if (road.city_id === 'delhi') aqi = Math.round(aqi * 1.3);

      // Write updates to DB
      run(`
        UPDATE roads 
        SET vehicle_count = ?, congestion_percent = ?, congestion_level = ?, avg_speed = ?, aqi = ?
        WHERE id = ?
      `, [count, congestionPercent, congestionLevel, avgSpeed, aqi, road.id]);

      // Record in log table
      run(`
        INSERT INTO congestion_logs (city_id, road_id, timestamp, congestion_percent, avg_speed, vehicle_count, aqi)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [road.city_id, road.id, nowStr, congestionPercent, avgSpeed, count, aqi]);
    });
  });
}

function simulateSignals(io) {
  const signals = query('SELECT * FROM signals');
  
  transaction(() => {
    signals.forEach(sig => {
      let { id, status, wait_time, timing_mode, active_priority, q_north, q_south, q_east, q_west } = sig;
      
      // Update directions
      if (status === 'RED') {
        q_north += Math.floor(Math.random() * 2);
        q_south += Math.floor(Math.random() * 2);
        q_east += Math.floor(Math.random() * 2);
        q_west += Math.floor(Math.random() * 2);
      } else if (status === 'GREEN') {
        q_north = Math.max(0, q_north - Math.floor(Math.random() * 3));
        q_south = Math.max(0, q_south - Math.floor(Math.random() * 3));
        q_east = Math.max(0, q_east - Math.floor(Math.random() * 3));
        q_west = Math.max(0, q_west - Math.floor(Math.random() * 3));
      }

      let totalQ = q_north + q_south + q_east + q_west;

      if (active_priority === 1) {
        // Clear immediately
        status = 'GREEN';
        wait_time = 30;
        q_north = Math.max(0, q_north - 3);
        q_south = Math.max(0, q_south - 3);
        q_east = Math.max(0, q_east - 3);
        q_west = Math.max(0, q_west - 3);
        totalQ = q_north + q_south + q_east + q_west;

        run(`
          UPDATE signals 
          SET status = ?, wait_time = ?, queue_length = ?, q_north = ?, q_south = ?, q_east = ?, q_west = ?
          WHERE id = ?
        `, [status, wait_time, totalQ, q_north, q_south, q_east, q_west, id]);
        return;
      }

      if (timing_mode === 'adaptive') {
        wait_time -= 5;

        // Queue extension logic
        if (status === 'GREEN' && totalQ > MAX_QUEUE_LIMIT && wait_time <= 5) {
          wait_time += 15;
          const msg = `[Adaptive Control] Signal auto-extended 15s at ${sig.junction_name} due to high queue (${totalQ} vehicles).`;
          console.log(msg);
          systemLogs.unshift({
            timestamp: new Date().toISOString(),
            message: msg,
            type: 'adaptive_extension',
            cityId: sig.city_id
          });
        }

        if (wait_time <= 0) {
          if (status === 'RED') {
            status = 'GREEN';
            wait_time = 30;
          } else if (status === 'GREEN') {
            status = 'AMBER';
            wait_time = 5;
          } else {
            status = 'RED';
            wait_time = 45;
          }
        }
      } else {
        if (wait_time > 0) wait_time -= 5;
      }

      run(`
        UPDATE signals 
        SET status = ?, wait_time = ?, queue_length = ?, q_north = ?, q_south = ?, q_east = ?, q_west = ?
        WHERE id = ?
      `, [status, wait_time, totalQ, q_north, q_south, q_east, q_west, id]);
    });
  });
}

function simulateCameras() {
  if (Math.random() >= RANDOM_VIOLATION_CHANCE) return;

  const cameras = query('SELECT * FROM cameras');
  const vehicles = query('SELECT * FROM vehicles');
  
  if (cameras.length === 0 || vehicles.length === 0) return;

  const camera = cameras[Math.floor(Math.random() * cameras.length)];
  const vehicle = vehicles[Math.floor(Math.random() * vehicles.length)];

  // Find signal state
  const signal = queryOne('SELECT status FROM signals WHERE camera_id = ?', [camera.id]);
  const signalStatus = signal ? signal.status : 'GREEN';

  let violationType = null;
  let details = '';

  if (signalStatus === 'RED' && Math.random() > 0.4) {
    violationType = 'Signal Jumping';
    details = `Ran red light at ${camera.name}`;
  } else if (Math.random() > 0.6) {
    violationType = 'Overspeeding';
    const speed = Math.round(camera.speed_limit + 12 + Math.random() * 25);
    details = `Spotted driving at ${speed} km/h (Limit: ${camera.speed_limit} km/h) at ${camera.name}`;
  } else if (Math.random() > 0.85) {
    violationType = 'Wrong-side Driving';
    details = `Wrong-side lane infraction at ${camera.name}`;
  }

  const nowStr = new Date().toISOString();

  transaction(() => {
    // Update vehicle last seen position in SQLite
    run(`
      UPDATE vehicles 
      SET last_seen_camera = ?, last_seen_time = ?
      WHERE reg_number = ?
    `, [camera.id, nowStr, vehicle.reg_number]);

    if (violationType) {
      // Flag vehicle
      const flagReason = violationType === 'Overspeeding' ? 'expired_PUC' : 'blacklisted';
      run(`
        UPDATE vehicles
        SET flagged = 1, flag_reason = ?
        WHERE reg_number = ?
      `, [flagReason, vehicle.reg_number]);

      // Update camera last violation
      run(`
        UPDATE cameras
        SET last_violation_type = ?, last_violation_time = ?, last_violation_reg = ?, last_violation_details = ?, live_count = MIN(100, live_count + 1)
        WHERE id = ?
      `, [violationType, nowStr, vehicle.reg_number, details, camera.id]);

      const logMsg = `[Violation Flagged] ${vehicle.reg_number} (${vehicle.type}): ${violationType} - ${details}`;
      console.log(logMsg);

      systemLogs.unshift({
        timestamp: nowStr,
        message: logMsg,
        type: 'violation',
        cityId: camera.city_id,
        regNumber: vehicle.reg_number
      });
    }
  });
}
