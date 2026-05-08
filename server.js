require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const clientRoutes = require("./routes/clients");
const catalogRoutes = require("./routes/catalog");
const quotationRoutes = require("./routes/quotations");
const financialRoutes = require("./routes/financial");
const companyRoutes = require("./routes/company");

const app = express();
app.use(cors());
app.use(express.json({ limit: "50mb" }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/catalog", catalogRoutes);
app.use("/api/quotations", quotationRoutes);
app.use("/api/financial", financialRoutes);
app.use("/api/company", companyRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "Rota nao encontrada" });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log("Backend rodando em porta " + PORT);
});
