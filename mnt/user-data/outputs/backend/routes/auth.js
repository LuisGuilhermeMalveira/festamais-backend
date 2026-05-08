const express = require('express');
const bcrypt = require('bcrypt');
const Joi = require('joi');
const pool = require('../config/database');
const { generateToken, verifyToken } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  company_name: Joi.string().required(),
  phone: Joi.string().optional()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// REGISTER
router.post('/register', async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) throw error;

    const { email, password, company_name, phone } = value;

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, company_name, phone) VALUES ($1, $2, $3, $4) RETURNING id, email, company_name',
      [email, password_hash, company_name, phone]
    );

    const user = result.rows[0];

    // Create default FREE plan subscription
    await pool.query(
      'INSERT INTO user_subscriptions (user_id, plan_id, status) VALUES ($1, $2, $3)',
      [user.id, 1, 'active'] // plan_id 1 = FREE
    );

    const token = generateToken(user.id, user.email);

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user,
      token
    });
  } catch (err) {
    next(err);
  }
});

// LOGIN
router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) throw error;

    const { email, password } = value;

    // Find user
    const result = await pool.query(
      'SELECT id, email, password_hash, company_name FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Get subscription info
    const subResult = await pool.query(
      'SELECT sp.name as plan_name, us.status FROM user_subscriptions us JOIN subscription_plans sp ON us.plan_id = sp.id WHERE us.user_id = $1 AND us.status = $2',
      [user.id, 'active']
    );

    const subscription = subResult.rows[0];

    const token = generateToken(user.id, user.email);

    res.json({
      message: 'Login realizado com sucesso',
      user: {
        id: user.id,
        email: user.email,
        company_name: user.company_name,
        plan: subscription?.plan_name || 'FREE'
      },
      token
    });
  } catch (err) {
    next(err);
  }
});

// GET CURRENT USER
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT id, email, company_name, phone FROM users WHERE id = $1 AND deleted_at IS NULL',
      [req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
