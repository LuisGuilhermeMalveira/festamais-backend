const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// GET FINANCIAL SUMMARY
router.get('/summary', verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `SELECT 
        SUM(CASE WHEN status = 'Quitado' THEN total_value ELSE 0 END) as received,
        SUM(CASE WHEN status = 'Pendente' THEN signal_received ELSE 0 END) as signal_received,
        SUM(CASE WHEN status = 'Pendente' THEN remaining_balance ELSE 0 END) as pending
       FROM financial_records
       WHERE user_id = $1`,
      [req.userId]
    );

    const summary = result.rows[0] || { received: 0, signal_received: 0, pending: 0 };

    res.json({
      total_received: parseFloat(summary.received) || 0,
      signal_received: parseFloat(summary.signal_received) || 0,
      pending_balance: parseFloat(summary.pending) || 0
    });
  } catch (err) {
    next(err);
  }
});

// GET ALL FINANCIAL RECORDS
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM financial_records WHERE user_id = $1';
    const params = [req.userId];

    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }

    query += ' ORDER BY event_date DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// RECORD SIGNAL PAYMENT
router.post('/:eventId/signal', verifyToken, async (req, res, next) => {
  try {
    const { signal_amount } = req.body;

    const result = await pool.query(
      `UPDATE financial_records 
       SET signal_received = $1, 
           remaining_balance = total_value - $1,
           updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $2 AND event_id = $3
       RETURNING *`,
      [signal_amount, req.userId, req.params.eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro financeiro não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// MARK EVENT AS PAID
router.post('/:eventId/paid', verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      `UPDATE financial_records 
       SET status = 'Quitado', 
           paid_date = CURRENT_DATE,
           remaining_balance = 0,
           updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND event_id = $2
       RETURNING *`,
      [req.userId, req.params.eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registro financeiro não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
