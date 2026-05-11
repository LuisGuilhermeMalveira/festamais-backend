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

// ── GET /api/catalog/public/:slug — catálogo público por slug da empresa ──
router.get("/public/:slug", async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase();

    // Busca todos os usuários e faz match por slug no Node
    const userResult = await pool.query(
      `SELECT id, company_name, phone, email, city, state, logo
       FROM users
       WHERE (is_admin = false OR is_admin IS NULL)
       AND (suspended = false OR suspended IS NULL)`
    );

    // Normaliza o nome para slug e compara
    function toSlug(str) {
      return (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const company = userResult.rows.find(function(u) {
      return toSlug(u.company_name) === slug;
    });

    if (!company) return res.status(404).json({ error: "Empresa não encontrada" });

    const items = await pool.query(
      `SELECT id, name, category, price_per_day, stock_total, unit, photo
       FROM catalog_items
       WHERE user_id = $1
       ORDER BY category, name`,
      [company.id]
    );

    res.json({
      company: {
        name: company.company_name,
        phone: company.phone,
        email: company.email,
        city: company.city,
        state: company.state,
        logo: company.logo
      },
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
