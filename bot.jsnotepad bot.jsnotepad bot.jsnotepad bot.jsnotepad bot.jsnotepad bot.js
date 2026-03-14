const TelegramBot = require('node-telegram-bot-api');

// Ton token Telegram
const token = "8663059232:AAFtu0Lo1Yp2V2_9tXr1I9ghLIQvkWUuT2s";

// Création du bot avec polling
const bot = new TelegramBot(token, { polling: true });

// Commande /start
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
`👋 Bienvenue sur Felina LOG&cc !

🔒 Connexion sécurisée activée.
Sélectionnez une option :`,
  {
    reply_markup: {
      keyboard: [
        ["🏪 Ouvrir la boutique"],
        ["💰 Solde"],
        ["💳 Recharger"],
        ["📞 Support"]
      ],
      resize_keyboard: true
    }
  });
});

// Actions pour les boutons
bot.on("message", (msg) => {
  if(msg.text == "🏪 Ouvrir la boutique"){
    bot.sendMessage(msg.chat.id,"Ouverture de la boutique...");
  }

  if(msg.text == "💰 Solde"){
    bot.sendMessage(msg.chat.id,"Ton solde est de 0€");
  }

  if(msg.text == "💳 Recharger"){
    bot.sendMessage(msg.chat.id,"Page de recharge bientôt disponible");
  }

  if(msg.text == "📞 Support"){
    bot.sendMessage(msg.chat.id,"Contacte le support : @support");
  }
});