const errorHandler = (err, req, res, next) => {
  console.error('Erro:', err);

  // JWT Errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token inválido' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expirado' });
  }

  // Validation Errors
  if (err.isJoi) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: err.details.map(d => d.message)
    });
  }

  // Database Errors
  if (err.code && err.code.startsWith('23')) {
    return res.status(400).json({ error: 'Dado duplicado ou inválido' });
  }

  // Default error
  res.status(err.status || 500).json({
    error: err.message || 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { errorHandler };
