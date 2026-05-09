require("dotenv").config();
const express = require("express");
const cors = require("cors");
const authRoutes = require("./routes/auth");
const clientRoutes = require("./routes/clients");
const catalogRoutes = require("./routes/catalog");
const quotationRoutes = require("./routes/quotations");
const financialRoutes = require("./routes/financial");
const companyRoutes = require("./routes/company");
const adminRoutes = require("./routes/admin");

const app = express();

app.use(
	cors({
		origin: "*",
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
		allowedHeaders: ["Content-Type", "Authorization"],
	}),
);

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
app.use("/api/admin", adminRoutes);

app.use((req, res) => {
	res.status(404).json({ error: "Rota nao encontrada" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log("Backend rodando em porta " + PORT);
});
