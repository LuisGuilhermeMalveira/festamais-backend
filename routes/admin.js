// routes/admin.js
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET || 'festamais_secret_2024';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'festamais_admin_2024';

// ── Middleware: verifica token admin ──
function adminAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token admin requerido' });
  }
  try {
    const decoded = jwt.verify(auth.split(' ')[1], JWT_SECRET);
    if (!decoded.is_admin) return res.status(403).json({ error: 'Acesso negado' });
    req.admin = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ── POST /api/admin/login ──
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_admin = true',
      [email]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Credenciais inválidas' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, is_admin: true },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, admin: { id: user.id, email: user.email } });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /api/admin/users ── Lista todos os usuários
router.get('/users', adminAuth, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.company_name,
        u.phone,
        u.city,
        u.state,
        u.plan,
        u.plan_expires_at,
        u.is_admin,
        u.created_at,
        (SELECT COUNT(*) FROM clients c WHERE c.user_id = u.id) AS total_clients,
        (SELECT COUNT(*) FROM quotations q WHERE q.user_id = u.id) AS total_quotations,
        (SELECT COUNT(*) FROM catalog_items ci WHERE ci.user_id = u.id) AS total_catalog
      FROM users u
      WHERE u.is_admin = false OR u.is_admin IS NULL
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Admin list users error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── GET /api/admin/stats ── Dashboard stats
router.get('/stats', adminAuth, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_admin = false OR is_admin IS NULL) AS total_users,
        COUNT(*) FILTER (WHERE plan = 'trial' AND plan_expires_at > NOW() AND (is_admin = false OR is_admin IS NULL)) AS trials_ativos,
        COUNT(*) FILTER (WHERE plan = 'trial' AND plan_expires_at BETWEEN NOW() AND NOW() + INTERVAL '3 days' AND (is_admin = false OR is_admin IS NULL)) AS expirando_em_3dias,
        COUNT(*) FILTER (WHERE plan = 'mensal' AND (is_admin = false OR is_admin IS NULL)) AS plano_mensal,
        COUNT(*) FILTER (WHERE plan = 'anual' AND (is_admin = false OR is_admin IS NULL)) AS plano_anual,
        COUNT(*) FILTER (WHERE (plan_expires_at < NOW() OR plan_expires_at IS NULL) AND (is_admin = false OR is_admin IS NULL)) AS expirados
      FROM users
    `);
    const row = stats.rows[0];
    // Receita estimada mensal
    const receita = (parseInt(row.plano_mensal) * 49) + (parseInt(row.plano_anual) * (470 / 12));
    res.json({ ...row, receita_mensal: receita.toFixed(2) });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── PUT /api/admin/users/:id ── Editar plano/expiração
router.put('/users/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { plan, plan_expires_at, suspended } = req.body;

    const fields = [];
    const values = [];
    let idx = 1;

    if (plan !== undefined) { fields.push(`plan = $${idx++}`); values.push(plan); }
    if (plan_expires_at !== undefined) { fields.push(`plan_expires_at = $${idx++}`); values.push(plan_expires_at); }
    if (suspended !== undefined) { fields.push(`suspended = $${idx++}`); values.push(suspended); }

    if (!fields.length) return res.status(400).json({ error: 'Nada para atualizar' });

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, email, plan, plan_expires_at`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Admin update user error:', err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// ── DELETE /api/admin/users/:id ── Deletar usuário e todos os dados
router.delete('/users/:id', adminAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    await client.query('DELETE FROM financial_records WHERE user_id = $1', [id]);
    await client.query('DELETE FROM quotations WHERE user_id = $1', [id]);
    await client.query('DELETE FROM clients WHERE user_id = $1', [id]);
    await client.query('DELETE FROM catalog_items WHERE user_id = $1', [id]);
    await client.query('DELETE FROM events WHERE user_id = $1', [id]);
    const result = await client.query('DELETE FROM users WHERE id = $1 AND (is_admin = false OR is_admin IS NULL) RETURNING id', [id]);
    if (!result.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Usuário não encontrado ou é admin' });
    }
    await client.query('COMMIT');
    res.json({ success: true, deleted_id: id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Admin delete user error:', err);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

// ── POST /api/admin/setup ── Criar conta admin (usar só 1x, depois desabilitar)
// Protegido por ADMIN_SECRET no body
router.post('/setup', async (req, res) => {
  try {
    const { email, password, secret } = req.body;
    if (secret !== ADMIN_SECRET) return res.status(403).json({ error: 'Secret inválido' });
    const hash = await bcrypt.hash(password, 10);
    // Adiciona coluna is_admin se não existir (idempotente)
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT false`);
    // Verifica se já existe
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rows.length) {
      await pool.query('UPDATE users SET password = $1, is_admin = true WHERE email = $2', [hash, email]);
      userId = existing.rows[0].id;
    } else {
      const ins = await pool.query(
        `INSERT INTO users (email, password, company_name, plan, is_admin) VALUES ($1, $2, 'Admin', 'admin', true) RETURNING id`,
        [email, hash]
      );
      userId = ins.rows[0].id;
    }
    res.json({ success: true, message: 'Admin criado! Desabilite esta rota em produção.', id: userId });
  } catch (err) {
    console.error('Admin setup error:', err);
    res.status(500).json({ error: 'Erro interno: ' + err.message });
  }
});

module.exports = router;
module.exports.adminAuth = adminAuth;
