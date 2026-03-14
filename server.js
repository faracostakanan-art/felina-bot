const express = require('express');
const bodyParser = require('body-parser');
const bot = require('./bot');
const db = require('./database');

const app = express();
app.use(bodyParser.json());

// Webhook BTC
app.post('/webhook/btc', (req, res) => {
  const data = req.body;
  const address = data.address;
  const montantBTC = data.value / 1e8;

  const recharge = db.prepare('SELECT * FROM recharges WHERE crypto = ? AND status = ?').get('BTC', 'pending');
  if(recharge) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(recharge.user_id);
    const nouveauSolde = user.solde + (montantBTC * 27000); // conversion BTC->€
    db.prepare('UPDATE users SET solde = ? WHERE id = ?').run(nouveauSolde, user.id);
    db.prepare('UPDATE recharges SET status = "confirmed" WHERE id = ?').run(recharge.id);
    bot.sendMessage(user.id, `✅ Recharge BTC confirmée ! ${montantBTC} BTC reçu. Nouveau solde : ${nouveauSolde.toFixed(2)}€`);
  }
  res.sendStatus(200);
});

// Webhook ETH/USDC
app.post('/webhook/eth', (req, res) => {
  const data = req.body;
  const address = data.to;
  const token = data.tokenSymbol;
  const montant = parseFloat(data.amount);

  const recharge = db.prepare('SELECT * FROM recharges WHERE crypto = ? AND status = ?').get(token, 'pending');
  if(recharge) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(recharge.user_id);
    const conversionRate = token === 'ETH' ? 1800 : 1;
    const nouveauSolde = user.solde + (montant * conversionRate);
    db.prepare('UPDATE users SET solde = ? WHERE id = ?').run(nouveauSolde, user.id);
    db.prepare('UPDATE recharges SET status = "confirmed" WHERE id = ?').run(recharge.id);
    bot.sendMessage(user.id, `✅ Recharge ${token} confirmée ! ${montant} ${token} reçu. Nouveau solde : ${nouveauSolde.toFixed(2)}€`);
  }
  res.sendStatus(200);
});

app.listen(3000, () => console.log('Server listening on port 3000'));