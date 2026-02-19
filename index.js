const TelegramBot = require('node-telegram-bot-api');
const http = require('http');

// --- TẠO CỔNG ẢO CHO RENDER ---
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot SWC đang hoat dong!\n');
});
const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Đã mở cổng ảo ${port} thành công!`));

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, {polling: true});
const webAppUrl = 'https://telegram-mini-app-k1n1.onrender.com';

// ĐỊNH DANH KÊNH VÀ NHÓM CỦA BẠN
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';

// Hàm tự động soi xem khách đã tham gia chưa
async function checkMembership(userId) {
    try {
        const channelMember = await bot.getChatMember(CHANNEL_USERNAME, userId);
        const groupMember = await bot.getChatMember(GROUP_USERNAME, userId);
        
        // Các trạng thái hợp lệ: Thành viên thường, Quản trị viên, Người tạo nhóm
        const validStatuses = ['member', 'administrator', 'creator'];
        const inChannel = validStatuses.includes(channelMember.status);
        const inGroup = validStatuses.includes(groupMember.status);
        
        return { inChannel, inGroup };
    } catch (error) {
        console.error("Lỗi soi thành viên:", error.message);
        return { error: true }; // Thường do bot chưa được cấp quyền Admin
    }
}

// LỜI CHÀO /start
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
    const welcomeText = `Chào mừng bạn đến với <b>Cộng Đồng SWC Việt Nam</b>! 🚂\n\nĐây là hệ thống tự động giúp bạn nhận thưởng Token SWGT và cập nhật tiến độ công nghệ uST, uTerra nhanh nhất.\n\n👇 Hãy chọn một nhiệm vụ bên dưới để bắt đầu:`;
    bot.sendMessage(chatId, welcomeText, opts);
});

// XỬ LÝ NÚT BẤM
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const chatId = message.chat.id;
    const userId = callbackQuery.from.id; // Lấy ID của người dùng thật đang bấm
    const category = callbackQuery.data;

    if (category === 'task_1') {
        const responseText = `<b>🎯 Nhiệm vụ Tân binh (Thưởng 20 SWGT):</b>\n\nĐể nhận thưởng, bạn bắt buộc phải tham gia cộng đồng của chúng tôi:\n1. Kênh tin tức: ${CHANNEL_USERNAME}\n2. Nhóm thảo luận: ${GROUP_USERNAME}\n\n👉 Tham gia xong, hãy bấm nút <b>[✅ KIỂM TRA THAM GIA]</b> để hệ thống tự động quét và trao thưởng!`;
        
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
        bot.sendMessage(chatId, responseText, opts);

    } else if (category === 'check_join') {
        // HỆ THỐNG QUÉT
        const status = await checkMembership(userId);
        
        if (status.error) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Hệ thống đang bảo trì hoặc Bot chưa được cấp quyền Admin trong nhóm! Vui lòng báo cho @Hovanloi.", show_alert: true });
            return;
        }

        // Đưa ra phán quyết
        if (status.inChannel && status.inGroup) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "🎉 Tuyệt vời! Hệ thống đã xác nhận bạn tham gia đầy đủ!", show_alert: true });
            bot.sendMessage(chatId, "✅ <b>NHIỆM VỤ HOÀN THÀNH!</b>\n\nHệ thống đã ghi nhận bạn tham gia Cộng đồng SWC.\n🎁 <b>Phần thưởng:</b> +20 SWGT.\n\n👉 <i>Hãy bấm [🚀 MỞ ỨNG DỤNG SWC NGAY] để vào Ví kiểm tra tài sản của bạn!</i>", { parse_mode: 'HTML' });
        } else if (!status.inChannel && !status.inGroup) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "❌ Bạn chưa tham gia Kênh và Nhóm nào cả. Hãy bấm các nút bên trên để tham gia nhé!", show_alert: true });
        } else if (!status.inChannel) {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn đã vào Nhóm nhưng chưa vào Kênh Tin Tức. Hãy tham gia nốt nhé!", show_alert: true });
        } else {
            bot.answerCallbackQuery(callbackQuery.id, { text: "⚠️ Bạn đã vào Kênh nhưng chưa vào Nhóm Thảo Luận. Hãy tham gia nốt nhé!", show_alert: true });
        }
    } 
    // Các nhiệm vụ khác giữ nguyên
    else if (category === 'task_2') {
        bot.sendMessage(chatId, "<b>📚 Nhiệm vụ Kiến thức:</b>\nHôm nay, hãy đọc bài viết mới nhất tại web hovanloi.net.", { parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: "📖 Đọc bài tại hovanloi.net", url: "https://hovanloi.net" }]] } });
    } else if (category === 'task_3') {
        bot.sendMessage(chatId, `<b>🤝 Nhiệm vụ Tăng trưởng:</b>\n\n👉 Gửi Link giới thiệu này cho bạn bè: https://t.me/Dau_Tu_SWC_bot?start=${chatId}`, { parse_mode: 'HTML' });
    } else if (category === 'task_4') {
        bot.sendMessage(chatId, "<b>👑 Đặc quyền & Đổi thưởng:</b>\n\nĐổi vé tham dự sự kiện VIP hoặc mua các khóa học đầu tư chiến lược.", { parse_mode: 'HTML' });
    }

    if (category !== 'check_join') {
        bot.answerCallbackQuery(callbackQuery.id);
    }
});

console.log("Hệ thống Não bộ Bot SWC đã khởi động thành công!");
