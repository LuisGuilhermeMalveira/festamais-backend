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

// GET - Disponibilidade por data para o catálogo público
router.get("/availability/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Data é obrigatória" });
    }

    // 1. Buscar empresa pelo user_id
    const companyResult = await pool.query(
      "SELECT id, buffer_days FROM users WHERE id = $1",
      [user_id]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];
    const bufferDays = company.buffer_days || 0;

    // 2. Buscar todos os itens da empresa
    const itemsResult = await pool.query(
      "SELECT id, name, stock_total FROM catalog_items WHERE user_id = $1",
      [user_id]
    );

    // 3. Calcular disponibilidade para cada item na data solicitada
    const availability = {};

    itemsResult.rows.forEach(item => {
      // Placeholder: disponível = stock_total (sem bloqueios implementados ainda)
      availability[item.id] = {
        stock_total: item.stock_total,
        disponivel: item.stock_total
      };
    });

    res.json({
      date: date,
      buffer_days: bufferDays,
      availability: availability
    });

  } catch (err) {
    console.error("Erro em /availability:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET - Catálogo público por user_id (IMUTÁVEL - nunca muda mesmo se empresa mudar nome)
router.get("/public/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    // Buscar empresa pelo user_id (não pelo slug - mais seguro!)
    const companyResult = await pool.query(
      "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE id = $1",
      [user_id]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];

    // Buscar itens da empresa
    const itemsResult = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [user_id]
    );

    res.json({
      company: company,
      items: itemsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET - Catálogo público por user_id (rota genérica - NUNCA MUDA!)
router.get("/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    // Buscar empresa pelo user_id (imutável!)
    const companyResult = await pool.query(
      "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE id = $1",
      [user_id]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];

    // Buscar itens da empresa
    const itemsResult = await pool.query(
      "SELECT id, name, category, price_per_day, unit, stock_total, photo FROM catalog_items WHERE user_id = $1 ORDER BY category, name",
      [user_id]
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
