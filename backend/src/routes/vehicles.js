import express from 'express';
import { query, queryOne } from '../db/index.js';

const router = express.Router();

// Get vehicle records with SQL search, filtering, and server-side pagination
router.get('/', (req, res) => {
  try {
    const { q, type, fuel, cityId, page = 1, limit = 12 } = req.query;

    let baseSql = `
      FROM vehicles v
      LEFT JOIN cameras c ON v.last_seen_camera = c.id
      WHERE 1=1
    `;
    const params = [];

    if (q) {
      baseSql += ` AND (v.reg_number LIKE ? OR v.owner LIKE ?)`;
      params.push(`%${q}%`, `%${q}%`);
    }

    if (type) {
      baseSql += ` AND v.type = ?`;
      params.push(type);
    }

    if (fuel) {
      baseSql += ` AND v.fuel_type = ?`;
      params.push(fuel);
    }

    if (cityId) {
      baseSql += ` AND c.city_id = ?`;
      params.push(cityId);
    }

    // Get total count
    const totalRes = queryOne(`SELECT COUNT(*) as total ${baseSql}`, params);
    const totalCount = totalRes.total;

    // Fetch paginated results
    const offset = (Number(page) - 1) * Number(limit);
    const selectSql = `
      SELECT v.*, c.name as last_seen_camera_name, c.city_id
      ${baseSql}
      ORDER BY v.last_seen_time DESC
      LIMIT ? OFFSET ?
    `;
    
    const rows = query(selectSql, [...params, Number(limit), Number(offset)]);
    
    const data = rows.map(r => ({
      regNumber: r.reg_number,
      owner: r.owner,
      type: r.type,
      fuelType: r.fuel_type,
      flagged: r.flagged === 1,
      flagReason: r.flag_reason,
      expiredDocuments: JSON.parse(r.expired_documents || '[]'),
      lastSeenCamera: r.last_seen_camera,
      lastSeenCameraName: r.last_seen_camera_name,
      lastSeenTime: r.last_seen_time
    }));

    res.json({
      totalCount,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(totalCount / limit),
      data
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// Get all flagged/alerts vehicles
router.get('/flagged', (req, res) => {
  try {
    const { cityId } = req.query;
    let sql = `
      SELECT v.*, c.name as last_seen_camera_name, c.city_id
      FROM vehicles v
      LEFT JOIN cameras c ON v.last_seen_camera = c.id
      WHERE v.flagged = 1
    `;
    const params = [];

    if (cityId) {
      sql += ` AND c.city_id = ?`;
      params.push(cityId);
    }

    sql += ` ORDER BY v.last_seen_time DESC`;
    const rows = query(sql, params);
    
    const data = rows.map(r => ({
      regNumber: r.reg_number,
      owner: r.owner,
      type: r.type,
      fuelType: r.fuel_type,
      flagged: true,
      flagReason: r.flag_reason,
      expiredDocuments: JSON.parse(r.expired_documents || '[]'),
      lastSeenCamera: r.last_seen_camera,
      lastSeenCameraName: r.last_seen_camera_name,
      lastSeenTime: r.last_seen_time,
      cityId: r.city_id
    }));

    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch flagged vehicles' });
  }
});

export default router;
