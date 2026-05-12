const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

// ===== ROTAS PRIVADAS (com autenticação) =====

// GET - Listar itens do catálogo da empresa
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nome, descricao, preco, unidade, stock_total, categoria, imagem, blocked_dates FROM catalog_items WHERE user_id = $1 ORDER BY categoria, nome",
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
    const { nome, descricao, preco, unidade, stock_total, categoria, imagem } = req.body;
    const result = await pool.query(
      "INSERT INTO catalog_items (user_id, nome, descricao, preco, unidade, stock_total, categoria, imagem, blocked_dates) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
      [req.userId, nome, descricao, preco, unidade, stock_total, categoria, imagem, JSON.stringify({})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH - Atualizar item do catálogo
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const { nome, descricao, preco, unidade, stock_total, categoria, imagem } = req.body;
    const result = await pool.query(
      "UPDATE catalog_items SET nome = $1, descricao = $2, preco = $3, unidade = $4, stock_total = $5, categoria = $6, imagem = $7 WHERE id = $8 AND user_id = $9 RETURNING *",
      [nome, descricao, preco, unidade, stock_total, categoria, imagem, req.params.id, req.userId]
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

// GET - Catálogo público por slug da empresa
router.get("/public/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Buscar empresa pelo slug
    const companyResult = await pool.query(
      "SELECT id, company_name, logo, phone, email, city, state, address, buffer_days FROM users WHERE slug = $1",
      [slug]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];

    // Buscar itens da empresa
    const itemsResult = await pool.query(
      "SELECT id, nome, descricao, preco, unidade, stock_total, categoria, imagem FROM catalog_items WHERE user_id = $1 ORDER BY categoria, nome",
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

// GET - Disponibilidade por data para o catálogo público
// Chamada: GET /api/catalog/availability/:slug?date=2024-06-15
router.get("/availability/:slug", async (req, res) => {
  try {
    const { slug } = req.params;
    const { date } = req.query; // formato: YYYY-MM-DD

    if (!date) {
      return res.status(400).json({ error: "Data é obrigatória" });
    }

    // 1. Buscar empresa pelo slug
    const companyResult = await pool.query(
      "SELECT id, buffer_days FROM users WHERE slug = $1",
      [slug]
    );

    if (!companyResult.rows[0]) {
      return res.status(404).json({ error: "Empresa não encontrada" });
    }

    const company = companyResult.rows[0];
    const companyId = company.id;
    const bufferDays = company.buffer_days || 0;

    // 2. Buscar todos os itens da empresa
    const itemsResult = await pool.query(
      "SELECT id, nome, stock_total, blocked_dates FROM catalog_items WHERE user_id = $1",
      [companyId]
    );

    // 3. Calcular disponibilidade para cada item na data solicitada
    const availability = {};

    itemsResult.rows.forEach(item => {
      const blockedDates = item.blocked_dates || {};
      const blockedQty = blockedDates[date] || 0;
      const disponivel = Math.max(0, item.stock_total - blockedQty);

      availability[item.id] = {
        stock_total: item.stock_total,
        comprometido: blockedQty,
        disponivel: disponivel
      };
    });

    // 4. Retornar resultado
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

module.exports = router;
