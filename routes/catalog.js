const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

// ===== ROTAS PRIVADAS (com autenticação) =====

// GET - Listar itens do catálogo da empresa
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST - Criar novo item no catálogo
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, category, price_per_day, unit, stock_total, photo } = req.body;
    const result = await pool.query(
      "INSERT INTO catalog_items (user_id, name, category, price_per_day, unit, stock_total, photo) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [req.userId, name, category, price_per_day, unit, stock_total, photo]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH - Atualizar item do catálogo
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const { name, category, price_per_day, unit, stock_total, photo } = req.body;
    const result = await pool.query(
      "UPDATE catalog_items SET name = $1, category = $2, price_per_day = $3, unit = $4, stock_total = $5, photo = $6 WHERE id = $7 AND user_id = $8 RETURNING *",
      [name, category, price_per_day, unit, stock_total, photo, req.params.id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE - Deletar item do catálogo
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM catalog_items WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ROTAS PÚBLICAS (sem autenticação) =====

// GET - Catálogo público por slug OU user_id
router.get("/public/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const isNumeric = /^\d+$/.test(identifier);

    const companyResult = await pool.query(
      isNumeric
        ? "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE id = $1"
        : "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE slug = $1",
      [identifier]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];

    const itemsResult = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [company.id]
    );

    res.json({ company, items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Disponibilidade de estoque por data (slug ou user_id + ?date=YYYY-MM-DD)
// ⚠️ DEVE vir antes de /:identifier para não ser engolida pelo catch-all
router.get("/availability/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Parâmetro 'date' obrigatório (YYYY-MM-DD)" });
    }

    // Validar formato da data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Formato de data inválido. Use YYYY-MM-DD" });
    }

    const isNumeric = /^\d+$/.test(identifier);

    // Buscar empresa
    const companyResult = await pool.query(
      isNumeric
        ? "SELECT id, buffer_days FROM users WHERE id = $1"
        : "SELECT id, buffer_days FROM users WHERE slug = $1",
      [identifier]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];
    const userId = company.id;
    const bufferDays = company.buffer_days || 0;

    // Buscar itens do catálogo
    const itemsResult = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [userId]
    );

    if (!itemsResult.rows.length) {
      return res.json({ availability: [] });
    }

    // Calcular itens comprometidos em eventos confirmados que conflitam com a data
    // Conflito: a data do evento solicitado cai dentro do período bloqueado pelo evento existente
    // Período bloqueado = [event_date - buffer_days, event_date + buffer_days]
    const committedResult = await pool.query(
      `SELECT
         (elem->>'id') AS item_id,
         SUM(COALESCE((elem->>'qty')::int, 1)) AS committed_qty
       FROM quotations q,
            jsonb_array_elements(q.items) AS elem
       WHERE q.user_id = $1
         AND q.status = 'Confirmado'
         AND q.items IS NOT NULL
         AND jsonb_typeof(q.items) = 'array'
         AND $2::date BETWEEN
               DATE(q.event_date) - ($3::int * INTERVAL '1 day')
               AND
               DATE(q.event_date) + ($3::int * INTERVAL '1 day')
       GROUP BY elem->>'id'`,
      [userId, date, bufferDays]
    );

    // Montar mapa de comprometidos: { item_id: qty }
    const committed = {};
    for (const row of committedResult.rows) {
      committed[String(row.item_id)] = parseInt(row.committed_qty) || 0;
    }

    // Calcular disponibilidade por item
    const availability = itemsResult.rows.map((item) => {
      const comprometido = committed[String(item.id)] || 0;
      const disponivel = Math.max(0, item.stock_total - comprometido);
      return {
        id: item.id,
        stock_total: item.stock_total,
        comprometido,
        disponivel,
      };
    });

    res.json({ date, availability });
  } catch (err) {
    console.error("Availability error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Catálogo público genérico catch-all (SEMPRE por último!)
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const isNumeric = /^\d+$/.test(identifier);

    const companyResult = await pool.query(
      isNumeric
        ? "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE id = $1"
        : "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE slug = $1",
      [identifier]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];

    const itemsResult = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [company.id]
    );

    res.json({ company, items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
