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

// GET - Catálogo público por slug OU user_id (compatível com ambos!)
router.get("/public/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Verificar se é número (user_id) ou texto (slug)
    const isNumeric = /^\d+$/.test(identifier);
    
    let companyResult;
    if (isNumeric) {
      // Se é número, buscar por user_id
      companyResult = await pool.query(
        "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE id = $1",
        [identifier]
      );
    } else {
      // Se é texto, buscar por slug
      companyResult = await pool.query(
        "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE slug = $1",
        [identifier]
      );
    }

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];

    // Buscar itens da empresa
    const itemsResult = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [company.id]
    );

    res.json({
      company: company,
      items: itemsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Catálogo público genérico (rota genérica/:identifier - APÓS /public/:identifier e /availability/:identifier)
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Verificar se é número (user_id) ou texto (slug)
    const isNumeric = /^\d+$/.test(identifier);
    
    let companyResult;
    if (isNumeric) {
      // Se é número, buscar por user_id
      companyResult = await pool.query(
        "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE id = $1",
        [identifier]
      );
    } else {
      // Se é texto, buscar por slug
      companyResult = await pool.query(
        "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE slug = $1",
        [identifier]
      );
    }

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];

    // Buscar itens da empresa
    const itemsResult = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [company.id]
    );

    res.json({
      company: company,
      items: itemsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
