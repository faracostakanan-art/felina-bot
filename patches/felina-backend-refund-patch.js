// =========================================================
// FELINA BACKEND — Patch refund (à ajouter au server.js existant)
// =========================================================

// ----------- 1) DATABASE MIGRATIONS (à ajouter dans database.js) -----------
// Ajoute ces lignes à la fin de database.js (AVANT `module.exports = db;`)
//
//   try {
//     db.prepare(`ALTER TABLE users ADD COLUMN refunds_today INTEGER DEFAULT 0`).run();
//   } catch (e) {}
//   try {
//     db.prepare(`ALTER TABLE users ADD COLUMN refunds_date TEXT DEFAULT ''`).run();
//   } catch (e) {}
//   try {
//     db.prepare(`ALTER TABLE orders ADD COLUMN refunded_at TEXT DEFAULT ''`).run();
//   } catch (e) {}


// ----------- 2) NOUVEAU ENDPOINT REFUND (à ajouter dans server.js) -----------
// À coller JUSTE AVANT le bloc /* -------------------- DEPOSITS -------------------- */
// (ou n'importe où avant `app.listen(...)`)

const MAX_REFUNDS_PER_DAY = 3;
const REFUND_WINDOW_HOURS = 24;

// Retourne la date du jour au format YYYY-MM-DD en fuseau Paris
function getParisDate() {
  return new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(new Date());
}

// Retourne user avec refund_count remis à 0 si nouveau jour
function getUserWithRefundReset(userId) {
  const today = getParisDate();
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(String(userId));
  if (!user) return null;

  if (user.refunds_date !== today) {
    db.prepare("UPDATE users SET refunds_today = 0, refunds_date = ? WHERE id = ?")
      .run(today, String(userId));
    user.refunds_today = 0;
    user.refunds_date = today;
  }
  return user;
}

// GET /api/user/:userId/refund-status  -> { refunds_today, refunds_left, max_per_day }
app.get("/api/user/:userId/refund-status", (req, res) => {
  try {
    const user = getUserWithRefundReset(req.params.userId);
    if (!user) {
      return res.json({
        refunds_today: 0,
        refunds_left: MAX_REFUNDS_PER_DAY,
        max_per_day: MAX_REFUNDS_PER_DAY
      });
    }
    const used = Number(user.refunds_today || 0);
    res.json({
      refunds_today: used,
      refunds_left: Math.max(0, MAX_REFUNDS_PER_DAY - used),
      max_per_day: MAX_REFUNDS_PER_DAY
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/orders/:userId/:orderId/refund
app.post("/api/orders/:userId/:orderId/refund", (req, res) => {
  try {
    const userId = String(req.params.userId);
    const orderId = req.params.orderId;

    const order = db.prepare(
      "SELECT * FROM orders WHERE id = ? AND user_id = ?"
    ).get(orderId, userId);

    if (!order) return res.status(404).json({ error: "Commande introuvable" });
    if (order.status === "REFUNDED") return res.status(400).json({ error: "Commande déjà remboursée" });
    if (order.status !== "COMPLETED") return res.status(400).json({ error: "Cette commande ne peut pas être remboursée" });

    // Vérifier fenêtre 24h (created_at est en UTC dans SQLite)
    const createdAt = new Date(order.created_at.replace(" ", "T") + "Z");
    const now = new Date();
    const hoursDiff = (now - createdAt) / (1000 * 60 * 60);
    if (hoursDiff > REFUND_WINDOW_HOURS) {
      return res.status(400).json({ error: "Délai de remboursement dépassé (plus de 24h)" });
    }

    // Vérifier limite quotidienne
    const user = getUserWithRefundReset(userId);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    const refundsToday = Number(user.refunds_today || 0);
    if (refundsToday >= MAX_REFUNDS_PER_DAY) {
      return res.status(429).json({
        error: `Limite de ${MAX_REFUNDS_PER_DAY} remboursements par jour atteinte`,
        refunds_left: 0
      });
    }

    // Récupérer les items de la commande
    const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(order.id);
    if (items.length === 0) return res.status(400).json({ error: "Commande vide" });

    const totalRefund = items.reduce((sum, i) => sum + Number(i.price), 0);

    // Transaction atomique : crédit balance + remet produits + update order
    const tx = db.transaction(() => {
      // Remet chaque produit en vente
      for (const item of items) {
        db.prepare(`
          INSERT INTO products (title, subtitle, price, image_url, hidden_content, visible)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(
          item.title,
          item.subtitle || "",
          Number(item.price),
          item.image_url || "",
          item.hidden_content || ""
        );
      }

      // Crédite balance + incrémente compteur refunds
      db.prepare(`
        UPDATE users
        SET balance = balance + ?,
            refunds_today = refunds_today + 1,
            refunds_date = ?
        WHERE id = ?
      `).run(totalRefund, getParisDate(), userId);

      // Update order status
      db.prepare(`
        UPDATE orders
        SET status = 'REFUNDED', refunded_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(order.id);
    });

    tx();

    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);

    res.json({
      success: true,
      refunded_amount: totalRefund,
      new_balance: Number(updatedUser.balance),
      refunds_left: MAX_REFUNDS_PER_DAY - Number(updatedUser.refunds_today || 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erreur serveur" });
  }
});
