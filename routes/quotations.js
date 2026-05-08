const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, client_name, event_date, items, total, status, created_at FROM quotations WHERE user_id = $1 ORDER BY created_at DESC", [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { client_name, event_date, items, total } = req.body;
    const result = await pool.query(
      "INSERT INTO quotations (user_id, client_name, event_date, items, total, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [req.userId, client_name, event_date, JSON.stringify(items), total, "Pendente"]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      "UPDATE quotations SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
      [status, req.params.id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM quotations WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
