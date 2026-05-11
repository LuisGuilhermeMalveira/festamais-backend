const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

// ── GET /api/catalog — lista itens do usuário logado ──
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM catalog_items WHERE user_id = $1 ORDER BY created_at DESC",
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/catalog/migrate — cria coluna photo ──
router.get("/migrate", async (req, res) => {
  try {
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS photo TEXT`);
    res.json({ success: true, message: 'Coluna photo criada!' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/catalog/debug — ver empresas no banco (remover em produção) ──
router.get("/debug-empresas", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, company_name, is_admin, suspended FROM users ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/catalog/fix-admin/:id — remove is_admin de uma conta ──
router.get("/fix-admin/:id", async (req, res) => {
  try {
    await pool.query(
      `UPDATE users SET is_admin = false WHERE id = $1`,
      [req.params.id]
    );
    res.json({ success: true, message: 'is_admin removido do id ' + req.params.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/catalog/availability/:slug?date=YYYY-MM-DD ──
// Retorna disponibilidade real de cada item cruzando com orçamentos confirmados/pendentes
router.get("/availability/:slug", async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();
    const date = req.query.date; // YYYY-MM-DD
    if (!date) return res.status(400).json({ error: 'Data obrigatória' });

    // Busca empresa pelo slug
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE`);
    let userResult = await pool.query(
      `SELECT id FROM users WHERE slug = $1 AND (suspended = false OR suspended IS NULL) LIMIT 1`,
      [slug]
    );

    // Fallback por nome
    if (!userResult.rows.length) {
      function toSlug(str) {
        return (str||'').toLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
      }
      const all = await pool.query(`SELECT id, company_name FROM users WHERE (is_admin=false OR is_admin IS NULL) AND (suspended=false OR suspended IS NULL)`);
      const found = all.rows.find(u => toSlug(u.company_name) === slug);
      if (!found) return res.status(404).json({ error: 'Empresa não encontrada' });
      userResult = { rows: [found] };
    }

    const userId = userResult.rows[0].id;

    // Busca todos os itens do catálogo
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS photo TEXT`);
    const itemsResult = await pool.query(
      `SELECT id, name, stock_total FROM catalog_items WHERE user_id = $1`,
      [userId]
    );

    // Busca orçamentos Confirmados e Pendentes que incluem a data solicitada
    // Considera conflito quando o event_date do orçamento é igual à data solicitada
    const quotationsResult = await pool.query(
      `SELECT items FROM quotations 
       WHERE user_id = $1 
       AND status IN ('Confirmado', 'Pendente')
       AND DATE(event_date) = DATE($2)`,
      [userId, date]
    );

    // Soma quantidades já comprometidas por item
    const comprometido = {};
    for (const q of quotationsResult.rows) {
      let itens = q.items;
      if (typeof itens === 'string') {
        try { itens = JSON.parse(itens); } catch(e) { itens = []; }
      }
      if (!Array.isArray(itens)) itens = [];
      for (const item of itens) {
        const itemId = item.id || item.catalogId;
        const qty = parseInt(item.qty || item.quantity || 1);
        if (itemId) {
          comprometido[itemId] = (comprometido[itemId] || 0) + qty;
        }
      }
    }

    // Calcula disponível real para cada item
    const availability = {};
    for (const item of itemsResult.rows) {
      const estoque = parseInt(item.stock_total) || 0;
      const ocupado = comprometido[item.id] || 0;
      availability[item.id] = {
        stock_total: estoque,
        comprometido: ocupado,
        disponivel: Math.max(0, estoque - ocupado)
      };
    }

    res.json({ date, availability });
  } catch (err) {
    console.error('Availability error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/catalog/public/:slug ──
router.get("/public/:slug", async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();

    // Garante colunas existem
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS photo TEXT`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE`);

    // Busca por slug fixo
    const userResult = await pool.query(
      `SELECT id, company_name, phone, email, city, state, logo, slug
       FROM users
       WHERE slug = $1
       AND (suspended = false OR suspended IS NULL)
       LIMIT 1`,
      [slug]
    );

    if (!userResult.rows.length) {
      // Fallback: tenta normalizar company_name (compatibilidade)
      const allUsers = await pool.query(
        `SELECT id, company_name, phone, email, city, state, logo, slug
         FROM users
         WHERE (is_admin = false OR is_admin IS NULL)
         AND (suspended = false OR suspended IS NULL)`
      );
      function toSlug(str) {
        return (str || '').toLowerCase().normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      }
      const company = allUsers.rows.find(u => toSlug(u.company_name) === slug);
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

      const items = await pool.query(
        `SELECT id, name, category, price_per_day, stock_total, unit, photo
         FROM catalog_items WHERE user_id = $1 ORDER BY category, name`,
        [company.id]
      );
      return res.json({
        company: { name: company.company_name, phone: company.phone, email: company.email, city: company.city, state: company.state, logo: company.logo, slug: company.slug },
        items: items.rows
      });
    }

    const company = userResult.rows[0];
    const items = await pool.query(
      `SELECT id, name, category, price_per_day, stock_total, unit, photo
       FROM catalog_items WHERE user_id = $1 ORDER BY category, name`,
      [company.id]
    );

    res.json({
      company: { name: company.company_name, phone: company.phone, email: company.email, city: company.city, state: company.state, logo: company.logo, slug: company.slug },
      items: items.rows
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/catalog — criar item ──
router.post("/", verifyToken, async (req, res) => {
  try {
    const { name, category, price_per_day, stock_total, unit, photo } = req.body;

    // Adiciona coluna photo se não existir (idempotente)
    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS photo TEXT`);

    const result = await pool.query(
      `INSERT INTO catalog_items (user_id, name, category, price_per_day, stock_total, unit, photo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, name, category, price_per_day, stock_total, unit || "unidade", photo || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/catalog/:id — atualizar item ──
router.put("/:id", verifyToken, async (req, res) => {
  try {
    const { name, category, price_per_day, stock_total, unit, photo } = req.body;

    await pool.query(`ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS photo TEXT`);

    const result = await pool.query(
      `UPDATE catalog_items
       SET name=$1, category=$2, price_per_day=$3, stock_total=$4, unit=$5, photo=$6
       WHERE id=$7 AND user_id=$8
       RETURNING *`,
      [name, category, price_per_day, stock_total, unit || "unidade", photo || null, req.params.id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/catalog/:id ──
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM catalog_items WHERE id=$1 AND user_id=$2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
