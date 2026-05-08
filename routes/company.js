const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT company_name, logo, phone, email, city, state, address FROM users WHERE id = $1", [req.userId]);
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/", verifyToken, async (req, res) => {
  try {
    const { company_name, logo, phone, email, city, state, address } = req.body;
    const result = await pool.query(
      "UPDATE users SET company_name = $1, logo = $2, phone = $3, email = $4, city = $5, state = $6, address = $7 WHERE id = $8 RETURNING company_name, logo, phone, email, city, state, address",
      [company_name, logo, phone, email, city, state, address, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
