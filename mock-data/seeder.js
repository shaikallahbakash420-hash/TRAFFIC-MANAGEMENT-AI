import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../traffic.db');

console.log('Seeding SQLite Database at:', DB_PATH);
const db = new Database(DB_PATH);

// 1. Drop existing tables to start clean
db.exec(`
  DROP TABLE IF EXISTS congestion_logs;
  DROP TABLE IF EXISTS incidents;
  DROP TABLE IF EXISTS vehicles;
  DROP TABLE IF EXISTS signals;
  DROP TABLE IF EXISTS cameras;
  DROP TABLE IF EXISTS roads;
  DROP TABLE IF EXISTS cities;
`);

// 2. Create Schema
db.exec(`
  CREATE TABLE cities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    center_lat REAL NOT NULL,
    center_lng REAL NOT NULL,
    avg_congestion INTEGER DEFAULT 0,
    avg_aqi INTEGER DEFAULT 0,
    active_incidents INTEGER DEFAULT 0,
    total_vehicles INTEGER DEFAULT 0
  );

  CREATE TABLE roads (
    id TEXT PRIMARY KEY,
    city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    polyline TEXT NOT NULL, -- JSON string array of coordinate arrays
    congestion_percent INTEGER DEFAULT 0,
    congestion_level TEXT DEFAULT 'green',
    avg_speed INTEGER NOT NULL,
    vehicle_count INTEGER DEFAULT 0,
    aqi INTEGER DEFAULT 0
  );

  CREATE TABLE cameras (
    id TEXT PRIMARY KEY,
    city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    road_id TEXT NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT DEFAULT 'active',
    live_count INTEGER DEFAULT 0,
    speed_limit INTEGER NOT NULL,
    last_violation_type TEXT,
    last_violation_time TEXT,
    last_violation_reg TEXT,
    last_violation_details TEXT
  );

  CREATE TABLE signals (
    id TEXT PRIMARY KEY,
    city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    camera_id TEXT NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    junction_name TEXT NOT NULL,
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    status TEXT DEFAULT 'RED', -- RED, GREEN, AMBER
    queue_length INTEGER DEFAULT 0,
    wait_time INTEGER DEFAULT 0,
    timing_mode TEXT DEFAULT 'adaptive', -- adaptive, manual
    active_priority INTEGER DEFAULT 0, -- 0 = false, 1 = true
    q_north INTEGER DEFAULT 0,
    q_south INTEGER DEFAULT 0,
    q_east INTEGER DEFAULT 0,
    q_west INTEGER DEFAULT 0
  );

  CREATE TABLE vehicles (
    reg_number TEXT PRIMARY KEY,
    owner TEXT NOT NULL,
    type TEXT NOT NULL,
    fuel_type TEXT NOT NULL,
    flagged INTEGER DEFAULT 0, -- 0 or 1
    flag_reason TEXT DEFAULT 'none',
    expired_documents TEXT DEFAULT '[]', -- JSON string array
    last_seen_camera TEXT REFERENCES cameras(id) ON DELETE SET NULL,
    last_seen_time TEXT
  );

  CREATE TABLE incidents (
    id TEXT PRIMARY KEY,
    city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    road_id TEXT NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- accident, breakdown, waterlogging, vip_movement, roadworks
    description TEXT NOT NULL,
    severity TEXT NOT NULL, -- low, medium, high
    reported_time TEXT NOT NULL,
    status TEXT DEFAULT 'reported' -- reported, resolving, resolved
  );

  CREATE TABLE congestion_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    road_id TEXT NOT NULL REFERENCES roads(id) ON DELETE CASCADE,
    timestamp TEXT NOT NULL,
    congestion_percent INTEGER NOT NULL,
    avg_speed INTEGER NOT NULL,
    vehicle_count INTEGER NOT NULL,
    aqi INTEGER NOT NULL
  );
`);

// 3. Insert Cities
const insertCity = db.prepare(`
  INSERT INTO cities (id, name, center_lat, center_lng, avg_congestion, avg_aqi, active_incidents, total_vehicles)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

insertCity.run('delhi', 'Delhi (NCR)', 28.6139, 77.2090, 58, 245, 2, 7420);
insertCity.run('mumbai', 'Mumbai', 19.0760, 72.8777, 62, 135, 3, 8150);
insertCity.run('bengaluru', 'Bengaluru', 12.9716, 77.5946, 68, 92, 4, 9330);
insertCity.run('pune', 'Pune', 18.5204, 73.8567, 48, 110, 1, 5200);
insertCity.run('hyderabad', 'Hyderabad', 17.3850, 78.4867, 42, 115, 0, 6100);

// Helper for roads coordinates
const insertRoad = db.prepare(`
  INSERT INTO roads (id, city_id, name, polyline, congestion_percent, congestion_level, avg_speed, vehicle_count, aqi)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Bengaluru Roads (10)
insertRoad.run('blr_orr', 'bengaluru', 'Outer Ring Road (Silk Board to HSR)', JSON.stringify([[12.9176, 77.6244], [12.9145, 77.6320], [12.9110, 77.6380], [12.9100, 77.6420]]), 82, 'red', 14, 142, 145);
insertRoad.run('blr_hosur', 'bengaluru', 'Hosur Road (Silk Board to Koramangala)', JSON.stringify([[12.9176, 77.6244], [12.9240, 77.6220], [12.9300, 77.6200], [12.9400, 77.6100]]), 54, 'yellow', 28, 98, 115);
insertRoad.run('blr_100ft', 'bengaluru', 'Indiranagar 100 Feet Road', JSON.stringify([[12.9719, 77.6412], [12.9660, 77.6411], [12.9600, 77.6410], [12.9520, 77.6405]]), 22, 'green', 45, 45, 72);
insertRoad.run('blr_mg', 'bengaluru', 'MG Road (Trinity to Brigade Road)', JSON.stringify([[12.9738, 77.6119], [12.9740, 77.6050], [12.9745, 77.6000], [12.9750, 77.5900]]), 78, 'red', 16, 125, 128);
insertRoad.run('blr_ecity', 'bengaluru', 'Electronic City Flyover', JSON.stringify([[12.8489, 77.6601], [12.8650, 77.6550], [12.8800, 77.6500], [12.9000, 77.6400]]), 30, 'green', 52, 60, 80);
insertRoad.run('blr_sarjapur', 'bengaluru', 'Sarjapur Road Junction', JSON.stringify([[12.9200, 77.6600], [12.9220, 77.6700], [12.9240, 77.6800]]), 48, 'yellow', 32, 85, 110);
insertRoad.run('blr_whitefield', 'bengaluru', 'Whitefield Main Road', JSON.stringify([[12.9698, 77.7500], [12.9690, 77.7400], [12.9680, 77.7300]]), 65, 'yellow', 22, 110, 130);
insertRoad.run('blr_bannerghatta', 'bengaluru', 'Bannerghatta Road (Dairy Circle)', JSON.stringify([[12.9390, 77.5970], [12.9250, 77.5990], [12.9100, 77.6010]]), 72, 'red', 18, 120, 142);
insertRoad.run('blr_tumkur', 'bengaluru', 'Tumkur Road Highway', JSON.stringify([[13.0280, 77.5400], [13.0400, 77.5200], [13.0600, 77.5000]]), 35, 'green', 58, 70, 78);
insertRoad.run('blr_oldmadras', 'bengaluru', 'Old Madras Road', JSON.stringify([[12.9850, 77.6400], [12.9900, 77.6600], [12.9950, 77.6800]]), 40, 'yellow', 38, 75, 95);

// Mumbai Roads (10)
insertRoad.run('mum_marine', 'mumbai', 'Marine Drive Promenade', JSON.stringify([[18.9430, 72.8230], [18.9360, 72.8210], [18.9300, 72.8200], [18.9200, 72.8180]]), 25, 'green', 48, 52, 85);
insertRoad.run('mum_sealink', 'mumbai', 'Bandra-Worli Sea Link', JSON.stringify([[19.0250, 72.8180], [19.0180, 72.8160], [19.0100, 72.8150], [18.9900, 72.8110]]), 42, 'yellow', 65, 110, 98);
insertRoad.run('mum_weh', 'mumbai', 'Western Express Highway (Andheri)', JSON.stringify([[19.1155, 72.8560], [19.1230, 72.8575], [19.1300, 72.8590], [19.1500, 72.8620]]), 88, 'red', 10, 210, 180);
insertRoad.run('mum_link', 'mumbai', 'Link Road (Khar to Santa Cruz)', JSON.stringify([[19.0770, 72.8360], [19.0830, 72.8350], [19.0900, 72.8340], [19.1000, 72.8330]]), 76, 'red', 18, 115, 155);
insertRoad.run('mum_sclr', 'mumbai', 'SCLR (Santacruz Chembur Link Road)', JSON.stringify([[19.0720, 72.8650], [19.0700, 72.8720], [19.0680, 72.8800], [19.0650, 72.9000]]), 60, 'yellow', 24, 130, 160);
insertRoad.run('mum_eeh', 'mumbai', 'Eastern Express Highway', JSON.stringify([[19.0800, 72.9200], [19.1000, 72.9300], [19.1200, 72.9400]]), 52, 'yellow', 45, 120, 122);
insertRoad.run('mum_jvlr', 'mumbai', 'JVLR (Jogeshwari Vikhroli Link)', JSON.stringify([[19.1300, 72.8700], [19.1280, 72.8900], [19.1250, 72.9100]]), 85, 'red', 12, 160, 175);
insertRoad.run('mum_colaba', 'mumbai', 'Colaba Causeway', JSON.stringify([[18.9200, 72.8300], [18.9100, 72.8280], [18.9000, 72.8250]]), 58, 'yellow', 20, 80, 110);
insertRoad.run('mum_dadar', 'mumbai', 'Dadar TT Circle Overpass', JSON.stringify([[19.0220, 72.8560], [19.0250, 72.8580], [19.0280, 72.8600]]), 75, 'red', 15, 135, 150);
insertRoad.run('mum_ghatkopar', 'mumbai', 'LBS Marg (Ghatkopar)', JSON.stringify([[19.0850, 72.9100], [19.0950, 72.9050], [19.1050, 72.9000]]), 68, 'yellow', 22, 105, 140);

// Delhi Roads (10)
insertRoad.run('del_dnd', 'delhi', 'DND Flyway (Noida to Delhi)', JSON.stringify([[28.5804, 77.2750], [28.5750, 77.2830], [28.5700, 77.2900], [28.5600, 77.3100]]), 48, 'yellow', 55, 160, 220);
insertRoad.run('del_ring_aiims', 'delhi', 'Ring Road (AIIMS Chowk to Lajpat Nagar)', JSON.stringify([[28.5672, 77.2100], [28.5676, 77.2180], [28.5680, 77.2250], [28.5690, 77.2400]]), 85, 'red', 12, 195, 310);
insertRoad.run('del_orr_nehru', 'delhi', 'Outer Ring Road (Nehru Place)', JSON.stringify([[28.5490, 77.2520], [28.5475, 77.2450], [28.5460, 77.2350], [28.5430, 77.2200]]), 74, 'red', 18, 135, 280);
insertRoad.run('del_cp', 'delhi', 'Connaught Place Inner Circle', JSON.stringify([[28.6304, 77.2177], [28.6290, 77.2160], [28.6280, 77.2150], [28.6300, 77.2200]]), 55, 'yellow', 22, 88, 195);
insertRoad.run('del_mathura', 'delhi', 'Mathura Road (Nizamuddin to Okhla)', JSON.stringify([[28.6130, 77.2450], [28.6000, 77.2480], [28.5900, 77.2500], [28.5700, 77.2600]]), 91, 'red', 8, 220, 340);
insertRoad.run('del_gt_road', 'delhi', 'GT Karnal Road', JSON.stringify([[28.7200, 77.1600], [28.7400, 77.1400], [28.7600, 77.1200]]), 42, 'yellow', 45, 95, 210);
insertRoad.run('del_nh8', 'delhi', 'Gurugram-Delhi Expressway (NH48)', JSON.stringify([[28.5300, 77.1000], [28.5150, 77.0800], [28.5000, 77.0600]]), 88, 'red', 14, 215, 290);
insertRoad.run('del_barapullah', 'delhi', 'Barapullah Flyover Bypass', JSON.stringify([[28.5850, 77.2300], [28.5830, 77.2500], [28.5810, 77.2700]]), 30, 'green', 62, 55, 140);
insertRoad.run('del_shanti', 'delhi', 'Shanti Path (Diplomatic Enclave)', JSON.stringify([[28.6000, 77.1900], [28.5900, 77.1920], [28.5800, 77.1950]]), 15, 'green', 55, 30, 98);
insertRoad.run('del_vikas', 'delhi', 'Vikas Marg (Laxmi Nagar)', JSON.stringify([[28.6360, 77.2600], [28.6350, 77.2750], [28.6340, 77.2900]]), 76, 'red', 16, 128, 295);

// Pune Roads (10)
insertRoad.run('pn_hinjewadi', 'pune', 'Hinjewadi Phase 1 Main Road', JSON.stringify([[18.5913, 73.7389], [18.5880, 73.7420], [18.5850, 73.7450], [18.5800, 73.7500]]), 80, 'red', 15, 110, 130);
insertRoad.run('pn_sb_road', 'pune', 'Senapati Bapat Road', JSON.stringify([[18.5362, 73.8304], [18.5320, 73.8307], [18.5280, 73.8310], [18.5200, 73.8320]]), 28, 'green', 42, 50, 88);
insertRoad.run('pn_karve', 'pune', 'Karve Road (Deccan to Kothrud)', JSON.stringify([[18.5080, 73.8340], [18.5050, 73.8270], [18.5020, 73.8200], [18.4980, 73.8100]]), 62, 'yellow', 25, 95, 125);
insertRoad.run('pn_solapur', 'pune', 'Pune-Solapur Road (Hadapsar)', JSON.stringify([[18.5060, 73.9120], [18.5050, 73.9200], [18.5040, 73.9300], [18.5020, 73.9500]]), 50, 'yellow', 38, 82, 112);
insertRoad.run('pn_univ', 'pune', 'University Chowk (Ganeshkhind Road)', JSON.stringify([[18.5529, 73.8275], [18.5480, 73.8330], [18.5430, 73.8400], [18.5350, 73.8500]]), 72, 'red', 18, 118, 140);
insertRoad.run('pn_sinhagad', 'pune', 'Sinhagad Road Corridor', JSON.stringify([[18.4900, 73.8300], [18.4750, 73.8200], [18.4600, 73.8100]]), 55, 'yellow', 30, 80, 115);
insertRoad.run('pn_camp', 'pune', 'MG Road (Camp Area)', JSON.stringify([[18.5130, 73.8780], [18.5100, 73.8750], [18.5080, 73.8720]]), 45, 'yellow', 28, 65, 95);
insertRoad.run('pn_wagholi', 'pune', 'Pune-Nagar Highway (Wagholi)', JSON.stringify([[18.5800, 73.9500], [18.5820, 73.9700], [18.5850, 73.9900]]), 78, 'red', 15, 125, 148);
insertRoad.run('pn_kalyani', 'pune', 'Kalyani Nagar Main Road', JSON.stringify([[18.5460, 73.9050], [18.5500, 73.9020], [18.5550, 73.9000]]), 30, 'green', 45, 42, 80);
insertRoad.run('pn_swargate', 'pune', 'Satara Road (Swargate)', JSON.stringify([[18.5018, 73.8636], [18.4900, 73.8580], [18.4800, 73.8550]]), 68, 'yellow', 24, 105, 128);

// Hyderabad Roads (10)
insertRoad.run('hyd_orr', 'hyderabad', 'Outer Ring Road (Gachibowli)', JSON.stringify([[17.4483, 78.3741], [17.4300, 78.3700], [17.4100, 78.3680]]), 35, 'green', 75, 115, 90);
insertRoad.run('hyd_hitec', 'hyderabad', 'Hitec City Cyber Towers Road', JSON.stringify([[17.4483, 78.3741], [17.4450, 78.3820], [17.4430, 78.3900], [17.4400, 78.3950]]), 85, 'red', 12, 175, 185);
insertRoad.run('hyd_jubilee', 'hyderabad', 'Jubilee Hills Road No 36', JSON.stringify([[17.4330, 78.4020], [17.4280, 78.4100], [17.4240, 78.4200]]), 64, 'yellow', 28, 92, 122);
insertRoad.run('hyd_pvnr', 'hyderabad', 'PVNR Expressway Airport Route', JSON.stringify([[17.3980, 78.4420], [17.3750, 78.4350], [17.3500, 78.4280]]), 22, 'green', 80, 64, 88);
insertRoad.run('hyd_begumpet', 'hyderabad', 'Begumpet Road Corridor', JSON.stringify([[17.4375, 78.4482], [17.4350, 78.4600], [17.4320, 78.4700]]), 78, 'red', 15, 140, 170);
insertRoad.run('hyd_rajbhavan', 'hyderabad', 'Raj Bhavan Road', JSON.stringify([[17.4230, 78.4550], [17.4150, 78.4580], [17.4100, 78.4600]]), 44, 'yellow', 35, 78, 102);
insertRoad.run('hyd_abids', 'hyderabad', 'Abids Main Road Shop Street', JSON.stringify([[17.3900, 78.4750], [17.3850, 78.4730], [17.3800, 78.4710]]), 58, 'yellow', 22, 85, 118);
insertRoad.run('hyd_charminar', 'hyderabad', 'Charminar Heritage Plaza Route', JSON.stringify([[17.3616, 78.4747], [17.3630, 78.4750], [17.3650, 78.4755]]), 88, 'red', 8, 155, 160);
insertRoad.run('hyd_miyapur', 'hyderabad', 'Kukatpally Highway (NH65)', JSON.stringify([[17.4960, 78.3725], [17.4850, 78.3880], [17.4720, 78.4060]]), 70, 'red', 20, 138, 158);
insertRoad.run('hyd_lbnagar', 'hyderabad', 'LB Nagar Ring Road', JSON.stringify([[17.3460, 78.5520], [17.3500, 78.5400], [17.3550, 78.5200]]), 52, 'yellow', 32, 90, 114);

// 4. Insert Cameras (30 camera nodes - 6 per city)
const insertCamera = db.prepare(`
  INSERT INTO cameras (id, city_id, name, road_id, lat, lng, status, live_count, speed_limit)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Bengaluru Cameras (6)
insertCamera.run('cam_blr_silkboard', 'bengaluru', 'Silk Board Junction camera 1', 'blr_orr', 12.9176, 77.6244, 'active', 38, 50);
insertCamera.run('cam_blr_hsr3', 'bengaluru', 'HSR Layout Sector 3 Chowk', 'blr_orr', 12.9110, 77.6380, 'active', 22, 50);
insertCamera.run('cam_blr_100ft', 'bengaluru', 'Indiranagar 100ft Double Rd', 'blr_100ft', 12.9600, 77.6410, 'active', 12, 60);
insertCamera.run('cam_blr_mg_res', 'bengaluru', 'MG Road - Brigade Rd Junction', 'blr_mg', 12.9738, 77.6119, 'active', 32, 50);
insertCamera.run('cam_blr_ecity', 'bengaluru', 'Electronic City Toll Plaza', 'blr_ecity', 12.8489, 77.6601, 'active', 15, 80);
insertCamera.run('cam_blr_sarjapur', 'bengaluru', 'Sarjapur Gate Intercept', 'blr_sarjapur', 12.9200, 77.6600, 'active', 25, 55);

// Mumbai Cameras (6)
insertCamera.run('cam_mum_marine', 'mumbai', 'Marine Drive - Chowpatty Chowk', 'mum_marine', 18.9430, 72.8230, 'active', 14, 60);
insertCamera.run('cam_mum_bandra', 'mumbai', 'Bandra BWSL Entrance Chowk', 'mum_sealink', 19.0250, 72.8180, 'active', 28, 80);
insertCamera.run('cam_mum_weh_andheri', 'mumbai', 'WEH - Andheri Flyover Junction', 'mum_weh', 19.1155, 72.8560, 'active', 45, 70);
insertCamera.run('cam_mum_link_khar', 'mumbai', 'Khar Link Road Intersection', 'mum_link', 19.0770, 72.8360, 'active', 30, 50);
insertCamera.run('cam_mum_sclr_chembur', 'mumbai', 'SCLR Chembur Junction', 'mum_sclr', 19.0650, 72.9000, 'active', 26, 60);
insertCamera.run('cam_mum_dadar', 'mumbai', 'Dadar TT Flyover Camera', 'mum_dadar', 19.0220, 72.8560, 'active', 34, 50);

// Delhi Cameras (6)
insertCamera.run('cam_del_dnd_noida', 'delhi', 'DND Flyway Noida Entry Toll', 'del_dnd', 28.5804, 77.2750, 'active', 29, 80);
insertCamera.run('cam_del_ring_aiims', 'delhi', 'Ring Road AIIMS Flyover Junction', 'del_ring_aiims', 28.5672, 77.2100, 'active', 48, 60);
insertCamera.run('cam_del_orr_nehru', 'delhi', 'Outer Ring Road Nehru Place', 'del_orr_nehru', 28.5490, 77.2520, 'active', 28, 50);
insertCamera.run('cam_del_cp_circle', 'delhi', 'CP Outer Circle Connaught Chowk', 'del_cp', 28.6304, 77.2177, 'active', 24, 40);
insertCamera.run('cam_del_mathura_niz', 'delhi', 'Mathura Road Nizamuddin Chowk', 'del_mathura', 28.6130, 77.2450, 'active', 52, 60);
insertCamera.run('cam_del_nh8_toll', 'delhi', 'NH48 Border Toll booth', 'del_nh8', 28.5300, 77.1000, 'active', 40, 70);

// Pune Cameras (6)
insertCamera.run('cam_pn_hinjewadi', 'pune', 'Hinjewadi Shivaji Chowk', 'pn_hinjewadi', 18.5913, 73.7389, 'active', 30, 50);
insertCamera.run('cam_pn_sb_road', 'pune', 'SB Road - ICC Trade Tower', 'pn_sb_road', 18.5362, 73.8304, 'active', 16, 50);
insertCamera.run('cam_pn_swargate', 'pune', 'Swargate Junction Corner', 'pn_swargate', 18.5018, 73.8636, 'active', 34, 50);
insertCamera.run('cam_pn_univ', 'pune', 'Pune University Chowk', 'pn_univ', 18.5529, 73.8275, 'active', 28, 60);
insertCamera.run('cam_pn_karve', 'pune', 'Karve Road Nal Stop Chowk', 'pn_karve', 18.5080, 73.8340, 'active', 25, 50);
insertCamera.run('cam_pn_kalyani', 'pune', 'Kalyani Bridge Cam', 'pn_kalyani', 18.5460, 73.9050, 'active', 12, 50);

// Hyderabad Cameras (6)
insertCamera.run('cam_hyd_hitec', 'hyderabad', 'Cyber Towers Intersection', 'hyd_hitec', 17.4483, 78.3741, 'active', 42, 60);
insertCamera.run('cam_hyd_jubilee', 'hyderabad', 'Jubilee Hills Rd 36 Plaza', 'hyd_jubilee', 17.4280, 78.4100, 'active', 28, 60);
insertCamera.run('cam_hyd_pvnr', 'hyderabad', 'PVNR Mehdipatnam Ramp', 'hyd_pvnr', 17.3980, 78.4420, 'active', 18, 80);
insertCamera.run('cam_hyd_begumpet', 'hyderabad', 'Begumpet Flyover Camera', 'hyd_begumpet', 17.4350, 78.4600, 'active', 35, 60);
insertCamera.run('cam_hyd_charminar', 'hyderabad', 'Laad Bazar Chowk', 'hyd_charminar', 17.3616, 78.4747, 'active', 38, 40);
insertCamera.run('cam_hyd_lbnagar', 'hyderabad', 'LB Nagar Ring Chowk', 'hyd_lbnagar', 17.3460, 78.5520, 'active', 30, 50);


// 5. Insert Signals (30 signal nodes corresponding to the 30 camera junctions)
const insertSignal = db.prepare(`
  INSERT INTO signals (id, city_id, camera_id, junction_name, lat, lng, status, queue_length, wait_time, timing_mode, active_priority, q_north, q_south, q_east, q_west)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

// Helper to seed signals corresponding to camera indexes
const cameraRows = db.prepare(`SELECT * FROM cameras`).all();
cameraRows.forEach(cam => {
  const signalId = `sig_${cam.id.slice(4)}`;
  // Default values
  const initStatus = Math.random() > 0.5 ? 'GREEN' : 'RED';
  const waitTime = initStatus === 'RED' ? 45 : 30;
  const qN = Math.floor(5 + Math.random() * 10);
  const qS = Math.floor(5 + Math.random() * 10);
  const qE = Math.floor(5 + Math.random() * 15);
  const qW = Math.floor(2 + Math.random() * 8);
  const totalQ = qN + qS + qE + qW;

  insertSignal.run(
    signalId,
    cam.city_id,
    cam.id,
    cam.name.replace(' Camera', '').replace(' camera', '').replace(' Bridge Cam', ' Chowk').replace(' Plaza', ' Chowk'),
    cam.lat,
    cam.lng,
    initStatus,
    totalQ,
    waitTime,
    'adaptive',
    0, // false
    qN, qS, qE, qW
  );
});


// 6. Insert Vehicles (300 vehicle records)
const insertVehicle = db.prepare(`
  INSERT INTO vehicles (reg_number, owner, type, fuel_type, flagged, flag_reason, expired_documents, last_seen_camera, last_seen_time)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const indianFirstNames = ['Rohan', 'Amit', 'Rahul', 'Vikram', 'Priya', 'Anjali', 'Arjun', 'Sneha', 'Deepak', 'Sanjay', 'Rajesh', 'Sunita', 'Neha', 'Divya', 'Karan', 'Vijay', 'Aditya', 'Preeti', 'Kunal', 'Manish', 'Suresh', 'Kiran', 'Aravind', 'Jyothi', 'Pradeep'];
const indianLastNames = ['Sharma', 'Verma', 'Patel', 'Kumar', 'Singh', 'Rao', 'Nair', 'Mehta', 'Gupta', 'Joshi', 'Choudhury', 'Reddy', 'Pillai', 'Deshmukh', 'Mishra', 'Iyer', 'Bose', 'Sen', 'Garg', 'Trivedi', 'Naidu', 'Sastry', 'Venkatesh'];
const fuelTypes = ['Petrol', 'Diesel', 'CNG', 'EV'];
const vehicleTypes = ['Car', 'Two-Wheeler', 'Auto-Rickshaw', 'Bus', 'Truck'];
const docTypes = ['Insurance', 'PUC'];

const camerasList = db.prepare(`SELECT * FROM cameras`).all();

for (let i = 0; i < 300; i++) {
  const cam = camerasList[Math.floor(Math.random() * camerasList.length)];
  const type = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
  const fuelType = type === 'Auto-Rickshaw' ? 'CNG' : (type === 'Bus' || type === 'Truck' ? 'Diesel' : fuelTypes[Math.floor(Math.random() * fuelTypes.length)]);
  
  // Format registration number: DL3CA1234, MH12AB9999, KA51MB4567, AP36YZ5555, etc.
  let state = 'MH';
  let cityCode = '12';
  if (cam.city_id === 'delhi') { state = 'DL'; cityCode = '3C'; }
  else if (cam.city_id === 'bengaluru') { state = 'KA'; cityCode = '51'; }
  else if (cam.city_id === 'hyderabad') { state = 'TS'; cityCode = '09'; }
  else if (cam.city_id === 'mumbai') { state = 'MH'; cityCode = '02'; }
  
  const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  const regNumber = `${state}${cityCode}${letters}${digits}`;

  const owner = `${indianFirstNames[Math.floor(Math.random() * indianFirstNames.length)]} ${indianLastNames[Math.floor(Math.random() * indianLastNames.length)]}`;
  
  let flagged = 0;
  let flagReason = 'none';
  let expiredDocs = [];
  
  if (i % 10 === 0) {
    flagged = 1;
    const reasons = ['stolen', 'blacklisted', 'expired_PUC', 'expired_insurance'];
    flagReason = reasons[Math.floor(Math.random() * reasons.length)];
    if (flagReason === 'expired_PUC') {
      expiredDocs.push('PUC');
    } else if (flagReason === 'expired_insurance') {
      expiredDocs.push('Insurance');
    }
  }

  const seenTime = new Date(Date.now() - Math.floor(Math.random() * 7200 * 1000)).toISOString();

  insertVehicle.run(
    regNumber,
    owner,
    type,
    fuelType,
    flagged,
    flagReason,
    JSON.stringify(expiredDocs),
    cam.id,
    seenTime
  );
}

// 7. Insert Incidents
const insertIncident = db.prepare(`
  INSERT INTO incidents (id, city_id, road_id, type, description, severity, reported_time, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

insertIncident.run('inc_1', 'bengaluru', 'blr_orr', 'breakdown', 'BMTC Bus breakdown blocking the left lane near HSR Flyover', 'medium', new Date(Date.now() - 1800000).toISOString(), 'reported');
insertIncident.run('inc_2', 'mumbai', 'mum_weh', 'accident', 'Minor bumper-to-bumper collision between two cars on Andheri flyover', 'high', new Date(Date.now() - 3600000).toISOString(), 'resolving');
insertIncident.run('inc_3', 'delhi', 'del_mathura', 'waterlogging', 'Severe waterlogging at Nizamuddin subway following heavy rain', 'high', new Date(Date.now() - 7200000).toISOString(), 'reported');
insertIncident.run('inc_4', 'pune', 'pn_hinjewadi', 'vip_movement', 'VIP convoy passing through Shivaji Chowk - expect intermittent closures', 'low', new Date(Date.now() - 900000).toISOString(), 'reported');

// 8. Pre-populate Congestion Logs (Historical profiles for graphs)
const insertLog = db.prepare(`
  INSERT INTO congestion_logs (city_id, road_id, timestamp, congestion_percent, avg_speed, vehicle_count, aqi)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const roadsList = db.prepare(`SELECT * FROM roads`).all();
const now = new Date();

roadsList.forEach(road => {
  // Generate 24 hours of logs
  for (let hour = 0; hour < 24; hour++) {
    const logTime = new Date(now);
    logTime.setHours(hour);
    logTime.setMinutes(0);
    logTime.setSeconds(0);

    let congestion = 30;
    if (hour >= 8 && hour <= 10) congestion = 75 + Math.floor(Math.random() * 15);
    else if (hour >= 18 && hour <= 21) congestion = 80 + Math.floor(Math.random() * 15);
    else if (hour > 10 && hour < 18) congestion = 45 + Math.floor(Math.random() * 15);
    else congestion = 15 + Math.floor(Math.random() * 15);

    let multiplier = 1.0;
    if (road.city_id === 'bengaluru') multiplier = 1.15;
    else if (road.city_id === 'mumbai') multiplier = 1.1;
    else if (road.city_id === 'pune') multiplier = 0.85;

    congestion = Math.min(100, Math.round(congestion * multiplier));
    const speed = Math.max(5, Math.round(60 - (60 - 6) * (congestion / 100)));
    const vCount = Math.round(congestion * 1.5);
    const aqiVal = Math.round(50 + (congestion / 100) * 300);

    insertLog.run(
      road.city_id,
      road.id,
      logTime.toISOString(),
      congestion,
      speed,
      vCount,
      aqiVal
    );
  }
});

console.log('Database seeded successfully with all entities!');
db.close();
