const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name, category, price_per_day, unit, stock_total FROM catalog_items WHERE user_id = $1", [req.userId]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, category, price_per_day, unit, stock_total } = req.body;
    const result = await pool.query(
      "INSERT INTO catalog_items (user_id, name, category, price_per_day, unit, stock_total) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [req.userId, name, category, price_per_day, unit, stock_total]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
