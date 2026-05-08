const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../config/database");
const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, company_name } = req.body;
    const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length) return res.status(400).json({ error: "Email ja cadastrado" });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password, company_name) VALUES ($1, $2, $3) RETURNING id, email, company_name",
      [email, hash, company_name || "Minha Empresa"]
    );
    const token = jwt.sign({ id: result.rows[0].id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (!result.rows.length) return res.status(401).json({ error: "Email ou senha incorretos" });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Email ou senha incorretos" });
    const token = jwt.sign({ id: user.id, email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user.id, email: user.email, company_name: user.company_name } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
