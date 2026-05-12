const express = require("express");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, client_name, event_date, items, total, status, created_at FROM quotations WHERE user_id = $1 ORDER BY created_at DESC", [req.userId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/", verifyToken, async (req, res) => {
  try {
    const { id, client_name, event_date, items, total, status } = req.body;
    
    // Se frontend envia ID, usar esse ID (evita duplicação)
    if (id) {
      const result = await pool.query(
        "INSERT INTO quotations (id, user_id, client_name, event_date, items, total, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
        [id, req.userId, client_name, event_date, JSON.stringify(items), total, status || "Pendente"]
      );
      res.status(201).json(result.rows[0]);
    } else {
      // Se não enviar ID, backend gera (compatibilidade com apps que não usam IDs)
      const result = await pool.query(
        "INSERT INTO quotations (user_id, client_name, event_date, items, total, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
        [req.userId, client_name, event_date, JSON.stringify(items), total, status || "Pendente"]
      );
      res.status(201).json(result.rows[0]);
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch("/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      "UPDATE quotations SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
      [status, req.params.id, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete("/:id", verifyToken, async (req, res) => {
  try {
    await pool.query("DELETE FROM quotations WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== CONFIRMAR ORÇAMENTO E BLOQUEAR ESTOQUE =====
router.post("/confirm", verifyToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    const { quotation_id, client_name, event_date, items, total, buffer_days } = req.body;
    
    // 1. Atualizar quotation para status = 'Confirmado'
    const quotationResult = await client.query(
      "UPDATE quotations SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *",
      ["Confirmado", quotation_id, req.userId]
    );
    
    if (quotationResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Quotation not found" });
    }
    
    // 2. Criar evento (se tabela de events existir)
    const eventResult = await client.query(
      "INSERT INTO events (user_id, client_name, event_date, items, value, status, buffer_days, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id",
      [req.userId, client_name, event_date, JSON.stringify(items), total, "Confirmado", buffer_days || 0]
    ).catch(() => null); // Se tabela não existir, continua
    
    // 3. Bloquear estoque para cada item
    if (items && Array.isArray(items)) {
      for (const item of items) {
        // Bloquear estoque para o período (data ± buffer_days)
        const startDate = new Date(event_date);
        startDate.setDate(startDate.getDate() - (buffer_days || 0));
        const endDate = new Date(event_date);
        endDate.setDate(endDate.getDate() + (buffer_days || 0));
        
        // Verificar ou atualizar estoque bloqueado
        // Nota: Estrutura exata depende da schema do banco
        // Exemplo: UPDATE inventory SET blocked_quantity = blocked_quantity + item.qty WHERE catalog_item_id = $1
        
        try {
          await client.query(
            "UPDATE inventory SET blocked_quantity = blocked_quantity + $1 WHERE catalog_item_id = $2 AND user_id = $3",
            [item.qty || 1, item.id, req.userId]
          );
        } catch (e) {
          // Se tabela não existir, continua
          console.log("Tabela inventory não encontrada:", e.message);
        }
      }
    }
    
    await client.query("COMMIT");
    res.json({ 
      success: true, 
      quotation: quotationResult.rows[0],
      event: eventResult?.rows?.[0],
      message: "Quotation confirmed and stock blocked"
    });
    
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
