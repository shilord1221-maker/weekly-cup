import TelegramBot from 'node-telegram-bot-api';
import { prisma } from '@/db.js';
import { processReferralBonus } from '@/routes/referral.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const MODERATOR_CHAT_ID = process.env.TELEGRAM_MODERATOR_CHAT_ID || '';

const bot = new TelegramBot(TOKEN, { polling: true });

function calcTokens(rub: number): number {
  return Math.floor(rub / 0.5); // 2 токена = 1₽
}

export function initTelegramBot() {
  if (!TOKEN || !MODERATOR_CHAT_ID) {
    console.log('⚠️ Telegram bot not configured');
    return;
  }

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id,
      `👋 Привет! Я бот Weekly Cup.\n\n` +
      `💎 Для покупки токенов:\n` +
      `1. Перейди на сайт → Магазин → Купить токены\n` +
      `2. Оплати через DonationAlerts\n` +
      `3. В сообщении укажи: email: твой@email.com\n` +
      `4. Отправь скриншот сюда\n\n` +
      `💰 Для выплаты реферальных:\n` +
      `/payout сумма номер_карты`
    );
  });

  // Скриншот оплаты
  bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    const fromId = msg.from?.id;
    const username = msg.from?.username || `id_${fromId}`;
    const caption = msg.caption || '';

    const emailMatch = caption.match(/email[:\s]+([^\s]+@[^\s]+)/i);
    const amountMatch = caption.match(/(\d+)\s*₽?/);

    if (!emailMatch || !amountMatch) {
      bot.sendMessage(chatId,
        `❌ Нужна подпись:\n` +
        `email: твой@email.com\n` +
        `сумма: 500\n` +
        `Пример: email: ivan@mail.com 500`
      );
      return;
    }

    const email = emailMatch[1];
    const amount = parseInt(amountMatch[1]);
    const tokens = calcTokens(amount);

    const photoId = msg.photo[msg.photo.length - 1].file_id;

    await bot.sendPhoto(MODERATOR_CHAT_ID, photoId, {
      caption:
        `🆕 Новая оплата!\n\n` +
        `👤 @${username}\n` +
        `📧 ${email}\n` +
        `💰 ${amount}₽ → ${tokens} токенов\n\n` +
        `✅ /approve_${fromId}_${amount}_${email.replace(/[@.]/g, '_')}\n` +
        `❌ /reject_${fromId}`,
    });

    bot.sendMessage(chatId, `✅ Отправлено на проверку!`);
  });

  // Одобрить
  bot.onText(/\/approve_(\d+)_(\d+)_(.+)/, async (msg, match) => {
    const telegramUserId = parseInt(match![1]);
    const amount = parseInt(match![2]);
    const email = match![3].replace(/_/g, '.').replace(/\.@/g, '@');
    const tokens = calcTokens(amount);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      bot.sendMessage(msg.chat.id, `❌ Пользователь ${email} не найден!`);
      return;
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { tokenBalance: { increment: tokens } } }),
      prisma.tokenTransaction.create({
        data: { userId: user.id, amount: tokens, reason: `DA_MANUAL:${amount}₽` },
      }),
    ]);

    // Реферальный бонус
    await processReferralBonus(user.id, amount);

    bot.sendMessage(telegramUserId, `🎉 Зачислено ${tokens} токенов!`);
    bot.sendMessage(msg.chat.id, `✅ ${tokens} токенов зачислено ${email}`);
  });

  // Отклонить
  bot.onText(/\/reject_(\d+)/, (msg, match) => {
    bot.sendMessage(parseInt(match![1]), `❌ Оплата отклонена.`);
    bot.sendMessage(msg.chat.id, `❌ Отклонено.`);
  });

  // Выплата
  bot.onText(/\/payout\s+(\d+)\s+(.+)/, async (msg, match) => {
    const amount = parseInt(match![1]);
    const details = match![2];
    const userId = msg.from?.id;

    if (amount < 500) {
      bot.sendMessage(msg.chat.id, `❌ Минимум 500₽`);
      return;
    }

    await bot.sendMessage(MODERATOR_CHAT_ID,
      `💰 Запрос выплаты!\n\n` +
      `👤 @${msg.from?.username}\n` +
      `💵 ${amount}₽\n` +
      `💳 ${details}\n\n` +
      `✅ /payout_approve_${userId}_${amount}\n` +
      `❌ /payout_reject_${userId}`
    );

    bot.sendMessage(msg.chat.id, `✅ Запрос отправлен!`);
  });

  bot.onText(/\/payout_approve_(\d+)_(\d+)/, (msg, match) => {
    bot.sendMessage(parseInt(match![1]), `✅ Выплата ${match![2]}₽ одобрена!`);
    bot.sendMessage(msg.chat.id, `✅ Выплата одобрена.`);
  });

  bot.onText(/\/payout_reject_(\d+)/, (msg, match) => {
    bot.sendMessage(parseInt(match![1]), `❌ Выплата отклонена.`);
    bot.sendMessage(msg.chat.id, `❌ Выплата отклонена.`);
  });

  console.log('🤖 Telegram bot initialized');
}

export { bot };