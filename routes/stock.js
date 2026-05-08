const express = require('express');
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { getCommittedItems } = require('../services/stockService');

const router = express.Router();

// GET STOCK STATUS
router.get('/', verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, name, category, stock_total FROM catalog_items WHERE user_id = $1 AND deleted_at IS NULL',
      [req.userId]
    );

    // Calculate availability for next 7 days
    const today = new Date().toISOString().split('T')[0];
    const stockStatus = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];

      const committed = await getCommittedItems(req.userId, dateStr);

      for (const item of result.rows) {
        if (!stockStatus[item.id]) {
          stockStatus[item.id] = {
            id: item.id,
            name: item.name,
            category: item.category,
            total: item.stock_total,
            availabilityByDay: {}
          };
        }
        const available = item.stock_total - (committed[item.id] || 0);
        stockStatus[item.id].availabilityByDay[dateStr] = Math.max(0, available);
      }
    }

    res.json(Object.values(stockStatus));
  } catch (err) {
    next(err);
  }
});

// GET STOCK FOR SPECIFIC DATE
router.get('/date/:date', verifyToken, async (req, res, next) => {
  try {
    const date = req.params.date;

    const items = await pool.query(
      'SELECT id, name, category, stock_total FROM catalog_items WHERE user_id = $1 AND deleted_at IS NULL',
      [req.userId]
    );

    const committed = await getCommittedItems(req.userId, date);

    const availability = items.rows.map(item => ({
      ...item,
      available: Math.max(0, item.stock_total - (committed[item.id] || 0)),
      committed: committed[item.id] || 0
    }));

    res.json(availability);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
