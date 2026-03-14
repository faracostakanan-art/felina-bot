const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

const token = process.env.BOT_TOKEN;
const API_URL = "https://felina-backend-production.up.railway.app";
const bot = new TelegramBot(token, { polling: true });

// Tes wallets crypto
const cryptoAddresses = {
  BTC: "bc1q2kd0kpzmvr9nz6xhwgvjpk7kapcw3wd9r6wjzz",
  ETH: "0x1F3E0A4E2ec341C718d706ACdabad874484033ae",
  USDC: "0x1F3E0A4E2ec341C718d706ACdabad874484033ae"
};

// Suivi des utilisateurs en train de recharger
const pendingRecharge = {};

// Menu principal
const mainMenu = {
  keyboard: [
    ["🏪 Ouvrir la boutique", "💰 Balance"],
    ["💳 Recharger", "📞 Support"]
  ],
  resize_keyboard: true
};

// Commande /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "👋 Bienvenue sur Felina LOG&cc !\n🔒 Connexion sécurisée activée.\n\nSélectionnez une option :",
    { reply_markup: mainMenu }
  );
});

// Gestion des messages
async function getUserBalance(userId) {
  const res = await axios.get(`${API_URL}/api/user/${userId}`);
  return res.data.balance || 0;
}

bot.on("message", async (msg) => {
  if (!msg.text) return;

  const chatId = msg.chat.id;

  // Gestion des recharges en attente
  if (pendingRecharge[chatId]) {
    const crypto = pendingRecharge[chatId];
    const montantCrypto = parseFloat(msg.text.replace(',', '.'));

    if (isNaN(montantCrypto) || montantCrypto <= 0) {
      bot.sendMessage(chatId, "❌ Montant invalide. Merci de saisir un nombre positif.");
      return;
    }

    bot.sendMessage(
      chatId,
      `💸 Pour finaliser le paiement en ${crypto}, envoie le montant à l'adresse suivante :\n\n${cryptoAddresses[crypto]}\n\n⚠️ Ton balance sera crédité automatiquement après confirmation de la transaction.`
    );

    delete pendingRecharge[chatId];

    bot.sendMessage(chatId, "Menu principal :", {
      reply_markup: mainMenu
    });

    return;
  }

  switch (msg.text) {
    case "🏪 Ouvrir la boutique":
      bot.sendMessage(chatId, "Clique ci-dessous pour accéder à la boutique :", {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🛒 Ouvrir la boutique",
                web_app: { url: "https://el-felina.vercel.app" }
              }
            ]
          ]
        }
      });
      break;

    case "💰 Balance":
  try {
    const balance = await getUserBalance(msg.from.id);
    bot.sendMessage(
      chatId,
      `Ton ID Telegram est : ${msg.from.id}\nTon balance est de ${Number(balance).toFixed(2)}€`
    );
  } catch (error) {
    console.error("Erreur chargement balance :", error.message);
    bot.sendMessage(chatId, "Erreur lors du chargement du balance.");
  }
  break;

    case "💳 Recharger":
      bot.sendMessage(chatId, "Choisis une crypto pour recharger :", {
        reply_markup: {
          keyboard: [
            ["BTC", "ETH"],
            ["USDC", "⬅️ Retour"]
          ],
          resize_keyboard: true
        }
      });
      break;

    case "BTC":
    case "ETH":
    case "USDC":
      pendingRecharge[chatId] = msg.text;
      bot.sendMessage(chatId, `Tu as choisi ${msg.text}. Combien veux-tu recharger ?`);
      break;

    case "⬅️ Retour":
      bot.sendMessage(chatId, "Menu principal :", {
        reply_markup: mainMenu
      });
      break;

    case "📞 Support":
      bot.sendMessage(chatId, "Contacte le support : @malusaint ");
      break;

    default:
      break;
  }
});

// Vérification des transactions
/*
async function checkTransactions() {
  // Fonction temporairement désactivée
}
*/

// setInterval(checkTransactions, 30000);
