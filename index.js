const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');

const userDB = {}; 

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }

    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        const userData = userDB[userId] || { balance: 0, wallet: '' };
        // BỘ THEO DÕI LÔI LÊN LOG CỦA RENDER
        console.log(`[API] Mini App đang hỏi số dư của user ${userId} -> Trả về:`, userData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(userData));
    } 
    else if (parsedUrl.pathname === '/api/save-wallet' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (!userDB[data.userId]) userDB[data.userId] = { balance: 0, wallet: '' };
                userDB[data.userId].wallet = data.wallet;
                console.log(`[API] Đã lưu ví ${data.wallet} cho user ${data.userId}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) { res.writeHead(400); res.end(); }
        });
    }
    else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('API SWC Online!\n');
    }
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`[HỆ THỐNG] Đã khởi chạy trên cổng ${port}`));

async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { 
            inChannel: validStatuses.includes(channelMember.status), 
            inGroup: validStatuses.includes(groupMember.status) 
        };
    } catch (error) { return { error: true }; }
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const opts = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: "1️⃣ Nhiệm vụ Tân binh", callback_data: 'task_1' }],
                [{ text: "2️⃣ Nhiệm vụ Kiến thức", callback_data: 'task_2' }],
                [{ text: "3️⃣ Tăng trưởng (Mời bạn bè)", callback_data: 'task_3' }],
                [{ text: "🎁 Đặc quyền & Đổi thưởng", callback_data: 'task_4' }],
                [{ text: "🚀 MỞ ỨNG DỤNG SWC (Kết nối ví)", web_app: { url: webAppUrl } }]
            ]
        }
    };
    bot.sendMessage(chatId, `Chào mừng bạn đến với <b>Cộng Đồng SWC Việt Nam</b>! 🚂`, opts);
});

bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString(); 
    const data = callbackQuery.data;

    if (data === 'task_1') {
        const opts = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🔵 Tham gia Kênh Tin Tức", url: "https://t.me/swc_capital_vn" }],
                    [{ text: "💬 Tham gia Nhóm Chat", url: "https://t.me/swc_capital_chat" }],
                    [{ text: "✅ KIỂM TRA THAM GIA", callback_data: 'check_join' }],
                    [{ text: "🚀 MỞ ỨNG DỤNG SWC NGAY", web_app: { url: webAppUrl } }]
                ]
            }
        };
        bot.sendMessage(chatId, `<b>🎯 Nhiệm vụ Tân binh (Thưởng 20 SWGT):</b>\nHãy tham gia 2 kênh trên và bấm nút Kiểm tra.`, opts);
    } 
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Lỗi Admin!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            if (!userDB[userId]) userDB[userId] = { balance: 0, wallet: '' };
            
            if (userDB[userId].balance === 0) {
                userDB[userId].balance = 20;
                console.log(`[BOT] Đã cộng 20 SWGT vào cơ sở dữ liệu cho user ${userId}`);
                bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Chúc mừng! +20 SWGT.", show_alert: true });
                bot.sendMessage(chatId, "✅ <b>NHIỆM VỤ HOÀN THÀNH!</b>\nSố dư đã được cập nhật vào Mini App.", { parse_mode: 'HTML' });
            } else {
                bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã nhận thưởng rồi!", show_alert: true });
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ.", show_alert: true });
        }
    }
    bot.answerCallbackQuery(callbackQuery.id);
});
