const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');

const userDB = {}; // Cơ sở dữ liệu tạm thời (Lưu tiền và Ví)

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

// --- 1. API SERVER CHO MINI APP ---
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.end(); return; }

    const parsedUrl = url.parse(req.url, true);
    
    if (parsedUrl.pathname === '/api/user' && req.method === 'GET') {
        const userId = parsedUrl.query.id;
        const userData = userDB[userId] || { balance: 0, wallet: '' };
        console.log(`[API] Lấy dữ liệu user ${userId}:`, userData);
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

// --- 2. HÀM KIỂM TRA THÀNH VIÊN ---
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        const validStatuses = ['member', 'administrator', 'creator'];
        return { 
            inChannel: validStatuses.includes(channelMember.status), 
            inGroup: validStatuses.includes(groupMember.status) 
        };
    } catch (error) { 
        return { error: true }; 
    }
}

// --- 3. XỬ LÝ LỆNH /start (HIỂN THỊ 5 NÚT BẤM) ---
bot.onText(/\/start(.*)/, (msg, match) => {
    const chatId = msg.chat.id;
    const refId = match[1].trim(); // Bắt ID của người giới thiệu nếu có
    
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
    
    let welcomeText = `Chào mừng bạn đến với <b>Cộng Đồng SWC Việt Nam</b>! 🚂\n\nĐây là hệ thống tự động giúp bạn nhận thưởng Token SWGT và cập nhật tiến độ công nghệ uST, uTerra nhanh nhất.\n\n👇 Hãy chọn một nhiệm vụ bên dưới để bắt đầu:`;
    
    // Nếu họ bấm qua link giới thiệu
    if (refId && refId !== chatId.toString()) {
        welcomeText = `🎉 <i>Bạn được mời bởi thành viên ID: ${refId}</i>\n\n` + welcomeText;
    }

    bot.sendMessage(chatId, welcomeText, opts);
});

// --- 4. XỬ LÝ NÚT BẤM VÀ CỘNG TIỀN ---
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
        bot.sendMessage(chatId, `<b>🎯 Nhiệm vụ Tân binh (Thưởng 20 SWGT):</b>\n\nĐể nhận thưởng, bạn bắt buộc phải tham gia cộng đồng của chúng tôi:\n1. Kênh tin tức: ${CHANNEL_USERNAME}\n2. Nhóm thảo luận: ${GROUP_USERNAME}\n\n👉 Tham gia xong, hãy bấm nút <b>[✅ KIỂM TRA THAM GIA]</b> để hệ thống tự động quét và trao thưởng!`, opts);
    } 
    else if (data === 'check_join') {
        const status = await checkMembership(userId);
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Hệ thống đang bảo trì hoặc Bot chưa được cấp quyền Admin!", show_alert: true });
        } else if (status.inChannel && status.inGroup) {
            if (!userDB[userId]) userDB[userId] = { balance: 0, wallet: '' };
            
            if (userDB[userId].balance === 0) {
                userDB[userId].balance = 20; // Cộng tiền
                bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Hệ thống đã xác nhận bạn tham gia đầy đủ! +20 SWGT.", show_alert: true });
                bot.sendMessage(chatId, "✅ <b>NHIỆM VỤ HOÀN THÀNH!</b>\n\nHệ thống đã ghi nhận bạn tham gia Cộng đồng SWC.\n🎁 <b>Phần thưởng:</b> +20 SWGT.\n\n👉 <i>Hãy bấm [🚀 MỞ ỨNG DỤNG SWC NGAY] để vào Ví kiểm tra tài sản của bạn!</i>", { parse_mode: 'HTML' });
            } else {
                bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Bạn đã hoàn thành nhiệm vụ này và nhận thưởng rồi nhé!", show_alert: true });
            }
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia đủ Kênh và Nhóm. Hãy kiểm tra lại nhé!", show_alert: true });
        }
    }
    else if (data === 'task_2') {
        bot.sendMessage(chatId, "<b>📚 Nhiệm vụ Kiến thức:</b>\nHôm nay, hãy đọc bài viết mới nhất tại web hovanloi.net.", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "📖 Đọc bài tại hovanloi.net", url: "https://hovanloi.net" }]] } });
    } 
    else if (data === 'task_3') {
        bot.sendMessage(chatId, `<b>🤝 Nhiệm vụ Tăng trưởng:</b>\n\n👉 Gửi Link giới thiệu này cho bạn bè:\nhttps://t.me/Dau_Tu_SWC_bot?start=${userId}`, { parse_mode: 'HTML' });
    } 
    else if (data === 'task_4') {
        bot.sendMessage(chatId, "<b>👑 Đặc quyền & Đổi thưởng:</b>\n\nĐổi vé tham dự sự kiện VIP hoặc mua các khóa học đầu tư chiến lược.", { parse_mode: 'HTML' });
    }

    if (data !== 'check_join') {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});
