const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM clients WHERE user_id = $1 ORDER BY created_at DESC", [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      "INSERT INTO clients (user_id, name, phone, email, address) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [req.userId, name, phone||"", email||"", address||""]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      "UPDATE clients SET name=$1, phone=$2, email=$3, address=$4 WHERE id=$5 AND user_id=$6 RETURNING *",
      [name, phone||"", email||"", address||"", req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Cliente não encontrado" });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM clients WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
