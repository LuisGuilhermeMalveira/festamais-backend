const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET ALL EVENTS
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events WHERE user_id = $1 AND deleted_at IS NULL ORDER BY event_date DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET EVENTS FOR DATE RANGE
router.get('/range', verifyToken, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await pool.query(
      'SELECT * FROM events WHERE user_id = $1 AND event_date BETWEEN $2 AND $3 AND deleted_at IS NULL ORDER BY event_date',
      [req.userId, startDate, endDate]
    );

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET EVENT BY ID
router.get('/:id', verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM events WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
      [req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// UPDATE EVENT
router.put('/:id', verifyToken, async (req, res, next) => {
  try {
    const { notes, total_value, signal_received } = req.body;

    const result = await pool.query(
      'UPDATE events SET notes = COALESCE($1, notes), total_value = COALESCE($2, total_value), signal_received = COALESCE($3, signal_received), updated_at = CURRENT_TIMESTAMP WHERE id = $4 AND user_id = $5 AND deleted_at IS NULL RETURNING *',
      [notes, total_value, signal_received, req.params.id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evento não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
