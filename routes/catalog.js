const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM catalog_items WHERE user_id = $1 ORDER BY created_at DESC", [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, category, price_per_day, stock_total, unit } = req.body;
    const result = await pool.query(
      "INSERT INTO catalog_items (user_id, name, category, price_per_day, stock_total, unit) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [req.userId, name, category, price_per_day, stock_total, unit || "unidade"]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { name, category, price_per_day, stock_total, unit } = req.body;
    const result = await pool.query(
      "UPDATE catalog_items SET name=$1, category=$2, price_per_day=$3, stock_total=$4, unit=$5 WHERE id=$6 AND user_id=$7 RETURNING *",
      [name, category, price_per_day, stock_total, unit || "unidade", req.params.id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM catalog_items WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
