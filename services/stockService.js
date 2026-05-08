const pool = require('../config/database');

// Helper to add/subtract days
function addDays(dateStr, days) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// Get items committed in ±1 day window
async function getCommittedItems(userId, eventDate) {
  const dayBefore = addDays(eventDate, -1);
  const dayAfter = addDays(eventDate, 1);

  const result = await pool.query(
    `SELECT e.id, jsonb_agg(
       jsonb_build_object('id', item->>'id', 'qty', (item->>'qty')::int)
     ) as items
     FROM events e,
     jsonb_array_elements(e.items) as item
     WHERE e.user_id = $1 
     AND e.event_date BETWEEN $2 AND $3
     AND e.deleted_at IS NULL
     GROUP BY e.id`,
    [userId, dayBefore, dayAfter]
  );

  const committed = {};
  result.rows.forEach(event => {
    if (event.items) {
      event.items.forEach(item => {
        const itemId = parseInt(item.id);
        committed[itemId] = (committed[itemId] || 0) + item.qty;
      });
    }
  });

  return committed;
}

// Validate if items can be allocated for quotation
async function validateStock(userId, items, eventDate) {
  try {
    const committed = await getCommittedItems(userId, eventDate);

    const errors = [];

    for (const item of items) {
      // Get item stock
      const result = await pool.query(
        'SELECT stock_total FROM catalog_items WHERE id = $1 AND user_id = $2',
        [item.id, userId]
      );

      if (result.rows.length === 0) {
        errors.push({
          itemId: item.id,
          itemName: item.name,
          message: 'Item não encontrado'
        });
        continue;
      }

      const stock = result.rows[0].stock_total;
      const commitedForItem = committed[item.id] || 0;
      const available = stock - commitedForItem;

      if (item.qty > available) {
        errors.push({
          itemId: item.id,
          itemName: item.name,
          requested: item.qty,
          available: Math.max(0, available),
          message: `Insuficiente. Solicitado: ${item.qty}, Disponível: ${Math.max(0, available)}`
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (err) {
    console.error('Erro na validação de estoque:', err);
    return {
      isValid: false,
      errors: [{ message: 'Erro ao validar estoque' }]
    };
  }
}

module.exports = { validateStock, getCommittedItems };
