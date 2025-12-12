/* server.js - Express backend with SQLite for contacts */
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------
// 🔐 YOUR ADMIN TOKEN (for now)
// ------------------------------
const ADMIN_TOKEN = "a7dd974a60f235e0be74f8c37962349376ca69c0eb1f02b0";

// front-end origin
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  "http://127.0.0.1:5500";

// ensure folders
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DATA_DIR = path.join(__dirname, "data");
const DB_DIR = path.join(__dirname, "db");

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR);

// DB path
const DB_PATH = path.join(DB_DIR, "shavion.db");

// Initialize SQLite DB
const db = new Database(DB_PATH);

// Create contacts table
db.exec(`
CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  screenshot TEXT,
  ip TEXT,
  created_at TEXT NOT NULL
);
`);

// prepared statements
const insertContactStmt = db.prepare(`
  INSERT INTO contacts (id, name, email, phone, message, screenshot, ip, created_at)
  VALUES (@id, @name, @email, @phone, @message, @screenshot, @ip, @created_at)
`);

const selectAllContactsStmt = db.prepare(`
  SELECT * FROM contacts ORDER BY created_at DESC
`);

// middleware
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------------------------
// CORS (DEV friendly)
// ------------------------------
const allowedOrigins = [
  FRONTEND_ORIGIN,
  "http://localhost:5500",
  "http://127.0.0.1:5500"
].filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");

  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();
});

// rate limiter
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 60,
  })
);

// multer upload handler
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = mime.extension(file.mimetype) || "bin";
    cb(null, `${Date.now()}-${uuidv4()}.${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ------------------------------
// ROUTES
// ------------------------------

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.post(
  "/api/contact",
  upload.single("screenshot"),
  body("name").isLength({ min: 2 }),
  body("email").isEmail(),
  body("message").isLength({ min: 3 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, email, phone, message } = req.body;
      const id = uuidv4();
      const created_at = new Date().toISOString();
      const ip = req.ip;
      const screenshot = req.file
        ? `/uploads/${path.basename(req.file.path)}`
        : null;

      insertContactStmt.run({
        id,
        name,
        email,
        phone: phone || null,
        message,
        screenshot,
        ip,
        created_at,
      });

      return res.status(201).json({ status: "ok", id });
    } catch (err) {
      console.error("Contact save error:", err);
      return res.status(500).json({ status: "error", message: "Internal error" });
    }
  }
);

// serve uploads (DEV ONLY)
app.use("/uploads", express.static(UPLOAD_DIR));

// ADMIN — GET CONTACT LIST
app.get("/admin/contacts", (req, res) => {
  const token = req.query.token || req.headers["x-admin-token"];

  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).send("Unauthorized");
  }

  const rows = selectAllContactsStmt.all();
  res.json({ count: rows.length, contacts: rows });
});

// error handler
app.use((err, req, res, next) => {
  console.error("ERROR:", err);
  return res.status(500).json({ status: "error", message: "Server error" });
});

// start server
app.listen(PORT, () =>
  console.log(`Backend running on http://localhost:${PORT} (DB: ${DB_PATH})`)
);
