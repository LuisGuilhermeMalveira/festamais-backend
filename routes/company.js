const express = require("express");
const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const { verifyToken } = require("../middleware/auth");
const router = express.Router();

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT company_name, logo, phone, email, city, state, address, plan, plan_expires_at, suspended, created_at, slug, buffer_days FROM users WHERE id = $1",
      [req.userId]
    );
    const row = result.rows[0] || {};
    res.json({
      company_name: row.company_name,
      logo: row.logo,
      phone: row.phone,
      email: row.email,
      city: row.city,
      state: row.state,
      address: row.address,
      slug: row.slug,
      buffer_days: row.buffer_days || 0,
      user: {
        plan: row.plan,
        plan_expires_at: row.plan_expires_at,
        suspended: row.suspended,
        created_at: row.created_at
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/", verifyToken, async (req, res) => {
  try {
    const { company_name, logo, phone, email, city, state, address } = req.body;
    const result = await pool.query(
      "UPDATE users SET company_name=$1, logo=$2, phone=$3, email=$4, city=$5, state=$6, address=$7 WHERE id=$8 RETURNING company_name, logo, phone, email, city, state, address, slug",
      [company_name, logo, phone, email, city, state, address, req.userId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──── PUT /company/slug – atualizar slug ────
router.put("/slug", verifyToken, async (req, res) => {
  try {
    const { slug } = req.body;
    if (!slug) return res.status(400).json({ error: 'Slug obrigatório' });

    // Valida formato
    const slugLimpo = slug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '');
    if (slugLimpo.length < 3) return res.status(400).json({ error: 'Slug muito curto (mínimo 3 caracteres)' });

    // Verifica se já existe
    const existe = await pool.query('SELECT id FROM users WHERE slug = $1 AND id != $2', [slugLimpo, req.userId]);
    if (existe.rows.length) return res.status(400).json({ error: 'Este link já está em uso. Escolha outro.' });

    await pool.query('UPDATE users SET slug = $1 WHERE id = $2', [slugLimpo, req.userId]);
    res.json({ success: true, slug: slugLimpo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put("/password", verifyToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const result = await pool.query("SELECT password FROM users WHERE id = $1", [req.userId]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: "Usuario nao encontrado" });
    const valid = await bcrypt.compare(current_password, user.password);
    if (!valid) return res.status(401).json({ error: "Senha atual incorreta" });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query("UPDATE users SET password=$1 WHERE id=$2", [hash, req.userId]);
    res.json({ success: true, message: "Senha alterada com sucesso" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──── GET /api/company/buffer – obter buffer_days ────
router.get("/buffer", verifyToken, async (req, res) => {
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS buffer_days INTEGER DEFAULT 0`);
    const result = await pool.query("SELECT buffer_days FROM users WHERE id = $1", [req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ buffer_days: result.rows[0].buffer_days || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ──── PUT /api/company/buffer – salvar buffer_days ────
router.put("/buffer", verifyToken, async (req, res) => {
  try {
    const buf = parseInt(req.body.buffer_days);
    if (isNaN(buf) || buf < 0 || buf > 2) return res.status(400).json({ error: "buffer_days deve ser entre 0 e 2" });

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS buffer_days INTEGER DEFAULT 0`);
    const result = await pool.query("UPDATE users SET buffer_days = $1 WHERE id = $2 RETURNING buffer_days", [buf, req.userId]);
    if (!result.rows.length) return res.status(404).json({ error: "Usuário não encontrado" });
    res.json({ success: true, buffer_days: result.rows[0].buffer_days });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
