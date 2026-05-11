const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const router = express.Router();

// Gera slug único a partir do nome
function toSlug(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function gerarSlugUnico(base) {
  let slug = toSlug(base);
  if (!slug) slug = 'empresa';
  let tentativa = slug;
  let i = 2;
  while (true) {
    const existe = await pool.query('SELECT id FROM users WHERE slug = $1', [tentativa]);
    if (!existe.rows.length) return tentativa;
    tentativa = slug + '-' + i++;
  }
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, company_name } = req.body;

    // Garante coluna slug existe
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE`);

    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length) return res.status(400).json({ error: "Email ja cadastrado" });

    const hash = await bcrypt.hash(password, 10);
    const slug = await gerarSlugUnico(company_name || 'minha-empresa');

    const result = await pool.query(
      `INSERT INTO users (email, password, company_name, plan, plan_expires_at, slug)
       VALUES ($1, $2, $3, 'trial', NOW() + INTERVAL '7 days', $4)
       RETURNING id, email, company_name, plan, plan_expires_at, slug`,
      [email, hash, company_name || "Minha Empresa", slug]
    );

    const token = jwt.sign({ id: result.rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Garante coluna slug existe
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE`);

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.status(401).json({ error: "Email ou senha incorretos" });

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Email ou senha incorretos" });

    // Se não tem slug, gera um agora
    if (!user.slug) {
      const slug = await gerarSlugUnico(user.company_name || 'empresa');
      await pool.query('UPDATE users SET slug = $1 WHERE id = $2', [slug, user.id]);
      user.slug = slug;
    }

    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        company_name: user.company_name,
        plan: user.plan,
        plan_expires_at: user.plan_expires_at,
        slug: user.slug,
        created_at: user.created_at
      }
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
