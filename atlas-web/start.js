const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DIST = path.join(__dirname, "dist");

// Serve static Vite build
app.use(express.static(DIST));

// SPA fallback: toute route renvoie index.html
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(DIST, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`atlas-web servi sur le port ${PORT}`);
});
