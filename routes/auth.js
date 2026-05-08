const express = require("express");
const bcrypt = require("bcrypt");
const pool = require("../config/database");
const { generateToken } = require("../middleware/auth");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { email, password, company_name } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, company_name) VALUES ($1, $2, $3) RETURNING id, email, company_name",
      [email, hash, company_name]
    );
    const user = result.rows[0];
    const token = generateToken(user.id, user.email);
    res.status(201).json({ message: "Usuario criado", user, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) return res.status(401).json({ error: "Invalido" });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalido" });
    const token = generateToken(user.id, user.email);
    res.json({ message: "Login ok", user: { id: user.id, email: user.email }, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
