require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { MongoClient } = require('mongodb');

// Khởi tạo Bot
const token = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Đường link Mini App
const MINI_APP_URL = "https://telegram-mini-app-k1n1.onrender.com"; 
// Link Group Zalo/Telegram để chốt sale
const GROUP_ZALO_LINK = "https://zalo.me/g/yeiaea989";

// --- KẾT NỐI MONGODB ---
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
let db, usersCollection;

async function connectDB() {
    try {
        await client.connect();
        db = client.db('Sky World Community VietNam');
        usersCollection = db.collection('users');
        console.log("✅ Đã kết nối MongoDB thành công!");
    } catch (error) {
        console.error("❌ Lỗi kết nối MongoDB:", error);
    }
}
connectDB();

// ==========================================
// 1. KỊCH BẢN /START - BẮT DATA & CHÀO MỪNG
// ==========================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || "bạn";

    const welcomeMessage = `Xin chào ${firstName}! 🦁\n\nChào mừng bạn bước vào Hệ sinh thái Đầu tư Tinh anh của **Sky World Community Viet Nam**.\n\nTôi là Trợ lý AI được phát triển dưới sự định hướng của Mr. **Hồ Văn Lợi**. Mục tiêu của chúng tôi: Vốn của bạn phải sinh lời và vị thế của bạn phải thăng hạng!\n\n🌱 Để nhận thông tin nội bộ và tham gia các thương vụ vòng kín (Private Round), vui lòng xác nhận chính sách bảo mật và chia sẻ số điện thoại của bạn bên dưới.`;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [
                [{ text: "📞 Chia sẻ Số điện thoại để bắt đầu", request_contact: true }],
                [{ text: "📜 Xem Chính sách bảo mật" }]
            ],
            resize_keyboard: true,
            one_time_keyboard: true
        }
    };

    bot.sendMessage(chatId, welcomeMessage, options);
});

// ==========================================
// 2. LƯU DATA VÀ MỞ KHÓA MENU CHÍNH 
// ==========================================
bot.on('contact', async (msg) => {
    const chatId = msg.chat.id;
    const phoneNumber = msg.contact.phone_number;
    const firstName = msg.from.first_name || "";

    // Lưu vào DB
    try {
        await usersCollection.updateOne(
            { chatId: chatId },
            { $set: { phone: phoneNumber, name: firstName, joinedAt: new Date(), tag: 'new' } },
            { upsert: true }
        );
    } catch (err) {
        console.log("Lỗi DB:", err);
    }

    const successMsg = `✅ Cảm ơn bạn! Hồ sơ đã được lưu trữ an toàn. Chào mừng bạn gia nhập cộng đồng những người xây dựng tương lai.\n\nNgay lúc này, cánh cửa **SWC Pass** và siêu dự án **ATLAS (Web 2.5 Real Estate)** đang đếm ngược đến ngày 31/03. Bạn muốn khám phá điều gì tiếp theo?`;

    const options = {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [
                [{ text: "🚀 MỞ ỨNG DỤNG SWC VIET NAM (Khuyên dùng)", web_app: { url: MINI_APP_URL } }],
                [{ text: "💎 Tìm hiểu SWC Pass & Quyền lợi", callback_data: 'menu_swcpass' }],
                [{ text: "🏢 Khám phá Siêu dự án ATLAS", callback_data: 'menu_atlas' }],
                [{ text: "🎟 Đăng ký Webinar 31/03", callback_data: 'menu_webinar' }],
                [{ text: "❓ Giải đáp thắc mắc (FAQ)", callback_data: 'menu_faq' }]
            ]
        }
    };

    bot.sendMessage(chatId, successMsg, options).then(() => {
        bot.sendMessage(chatId, "Bấm các nút phía trên để khám phá ☝️", { reply_markup: { remove_keyboard: true } });
    });

    // ---------------------------------------------------------
    // KỊCH BẢN DELAY: GỬI KHẢO SÁT SAU 1 PHÚT (Demo)
    // Thực tế anh có thể đổi 60000 (1 phút) thành 86400000 (24 giờ)
    // ---------------------------------------------------------
    setTimeout(() => {
        const surveyMsg = `Xin chào ${firstName}! Chúng tôi muốn hiểu bạn rõ hơn 🙌\n\nMột số người trong cộng đồng Sky World Community Viet Nam đã đầu tư nhiều năm, một số khác mới bắt đầu những bước đầu tiên. Để Mr. Hồ Văn Lợi và đội ngũ hỗ trợ bạn tốt nhất, hãy dành 10 giây cho chúng tôi biết vị thế hiện tại của bạn:`;
        const surveyOptions = {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "🙋‍♂️ Tôi là nhà đầu tư mới", callback_data: 'survey_newbie' }],
                    [{ text: "💼 Tôi đã đầu tư uST từ lâu", callback_data: 'survey_ust' }],
                    [{ text: "🔥 Tôi đã có thẻ SWC Pass", callback_data: 'survey_vip' }]
                ]
            }
        };
        bot.sendMessage(chatId, surveyMsg, surveyOptions);
    }, 60000); 
});

// ==========================================
// 3. XỬ LÝ TOÀN BỘ NÚT BẤM (KỊCH BẢN RẼ NHÁNH)
// ==========================================
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    let text = "";
    let options = { parse_mode: 'Markdown', disable_web_page_preview: true, reply_markup: { inline_keyboard: [] } };

    const ctaButtons = [
        [{ text: "🚀 MỞ ỨNG DỤNG ĐĂNG KÝ NGAY", web_app: { url: MINI_APP_URL } }],
        [{ text: "💬 THAM GIA NHÓM ZALO KÍN", url: GROUP_ZALO_LINK }],
        [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }]
    ];

    // --- MENU CHÍNH ---
    if (data === 'main_menu') {
        text = `Bạn muốn khám phá điều gì tiếp theo cùng Sky World Community Viet Nam?`;
        options.reply_markup.inline_keyboard = [
            [{ text: "🚀 MỞ ỨNG DỤNG SWC VIET NAM", web_app: { url: MINI_APP_URL } }],
            [{ text: "💎 Tìm hiểu SWC Pass & Quyền lợi", callback_data: 'menu_swcpass' }],
            [{ text: "🏢 Khám phá Siêu dự án ATLAS", callback_data: 'menu_atlas' }],
            [{ text: "🎟 Đăng ký Webinar 31/03", callback_data: 'menu_webinar' }],
            [{ text: "❓ Giải đáp thắc mắc (FAQ)", callback_data: 'menu_faq' }]
        ];
    }
    
    else if (data === 'menu_swcpass') {
        text = `Gói đăng ký **SWC Pass** là tấm vé thông hành của giới tinh anh, bao gồm:\n\n1️⃣ **ROAD TO $1M:** Chiến lược xây dựng danh mục cổ phiếu cổ tức mỗi tháng.\n2️⃣ **SWC Field:** Tiếp cận các thương vụ ngoài thị trường chứng khoán (như dự án ATLAS).\n3️⃣ **Tiến độ cá nhân:** Mục tiêu của bạn được số hóa rõ ràng.\n\n👉 Chi tiết bảng giá tại: swcpass.vn`;
        options.reply_markup.inline_keyboard = ctaButtons;
    } 
    
    else if (data === 'menu_atlas') {
        text = `Dự án **ATLAS** là tương lai của Bất động sản số hóa (RWA) tại UAE và toàn cầu. Bằng cách mã hóa tài sản thực thành token ATLX, ATLAS phá vỡ rào cản độc quyền của giới siêu giàu, mang lại thanh khoản cực nhanh.\n\n⚠️ ATLAS chỉ phân phối nội bộ qua **SWC Field**. Vòng kín tốt nhất sẽ khép lại vào 31/03!\n\n👉 Khám phá danh mục tại: swcfield.com`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }

    else if (data === 'menu_webinar') {
        text = `Sự kiện phát sóng trực tiếp sẽ giải mã siêu dự án mới trên gian hàng SWC Field.\n\n⏰ 20:00 (VN) | Ngày 31/03\n👉 Link phòng họp kín: https://launch.swc.capital/broadcast_31_vi\n\nHãy lưu lại lịch và tham gia nhóm Zalo để nhận thông báo!`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }

    // --- MENU FAQ ---
    else if (data === 'menu_faq' || data === 'faq_back') {
        text = `**CHUYÊN MỤC GIẢI ĐÁP THẮC MẮC (FAQ)**\n*Hãy chọn câu hỏi bạn đang quan tâm:*`;
        options.reply_markup.inline_keyboard = [
            [{ text: "1. Nhận được gì ngay sau khi thanh toán?", callback_data: 'faq_1' }],
            [{ text: "2. Road to $1M và SWC Field là gì?", callback_data: 'faq_2' }],
            [{ text: "3. SWC Pass khác gì nội dung Youtube miễn phí?", callback_data: 'faq_3' }],
            [{ text: "4. Tôi chưa có đủ 600$ lúc này?", callback_data: 'faq_4' }],
            [{ text: "5. Giữ tiền mặt cho an toàn thời điểm này?", callback_data: 'faq_5' }],
            [{ text: "🔙 Quay lại Menu Chính", callback_data: 'main_menu' }]
        ];
    }

    // --- CÂU TRẢ LỜI FAQ ---
    else if (data === 'faq_1') {
        text = `✅ **Tôi nhận được gì ngay sau khi thanh toán?**\nQuyền truy cập đầy đủ vào Road to $1M. Chiến lược xây dựng danh mục cổ phiếu cổ tức đầu tiên sẽ có trong tài khoản của bạn chỉ sau vài phút. Không cần chờ đợi!`;
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]);
    }
    else if (data === 'faq_2') {
        text = `✅ **Road to $1M & SWC Field là gì?**\n- **Road to $1M:** Chiến lược chuyên nghiệp để xây danh mục cổ phiếu cổ tức. Mỗi tháng bạn nhận 1 kế hoạch mua cụ thể.\n- **SWC Field:** Gian hàng dự án đầu tư mạo hiểm đã được thẩm định khắt khe (Ra mắt 3/2026).`;
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]);
    }
    else if (data === 'faq_3') {
        text = `✅ **Khác gì kiến thức trên Youtube?**\nViệc "biết" và việc có "kỷ luật" thực thi là hai vũ trụ khác nhau. SWC Pass không bán lý thuyết; nó cung cấp một "Hệ thống thực thi kỷ luật" giúp loại bỏ cảm xúc ra khỏi đầu tư. Kiến thức không hành động là giải trí; kỷ luật mới tạo ra tiền.`;
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]);
    }
    else if (data === 'faq_4') {
        text = `✅ **Tôi chưa có đủ 600$ lúc này?**\n600$ cho 5 năm nghĩa là chỉ ~250k VNĐ/tháng. Việc trì hoãn chờ "có đủ tiền" là cái bẫy hoàn hảo. Mỗi tháng chờ đợi, bạn vĩnh viễn đánh mất hàng ngàn đô la từ sức mạnh lãi kép. Đừng ưu tiên chi tiêu ngắn hạn mà bỏ lỡ tự do dài hạn!`;
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]);
    }
    else if (data === 'faq_5') {
        text = `✅ **Giữ tiền mặt cho an toàn?**\nGiữ tiền mặt vì sợ rủi ro là ảo giác nguy hiểm nhất. Khi ngân hàng trung ương in tiền, lạm phát lặng lẽ móc túi bạn mỗi ngày. Quyết định trốn tránh rủi ro biến động chính là quyết định đảm bảo 100% rằng bạn sẽ nghèo đi.`;
        options.reply_markup.inline_keyboard.push([{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }]);
    }

    // --- XỬ LÝ KHẢO SÁT (SURVEY) & NURTURING ---
    else if (data === 'survey_newbie') {
        try { await usersCollection.updateOne({ chatId: chatId }, { $set: { tag: 'newbie' } }); } catch(e){}
        text = `Cảm ơn bạn đã chia sẻ! Với tư cách là người mới, lạm phát đang âm thầm ăn mòn tiền mặt của bạn mỗi ngày. Giải pháp duy nhất là một cỗ máy tự động hóa dòng tiền.\n\n👉 Lựa chọn tốt nhất cho bạn lúc này là chiến lược kỷ luật **Road to $1M**. Hãy bấm nút bên dưới để vào nhóm nhận tư vấn lộ trình nhé!`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM NHẬN LỘ TRÌNH TỪ MR. LỢI", url: GROUP_ZALO_LINK }]];
    }
    else if (data === 'survey_ust') {
        try { await usersCollection.updateOne({ chatId: chatId }, { $set: { tag: 'ust_investor' } }); } catch(e){}
        text = `Tuyệt vời! Bạn là một nhà đầu tư có tầm nhìn. Nếu bạn đã quen với các dự án mạo hiểm, **ATLAS (Bất động sản số hóa Web3)** chính là sân chơi tiếp theo của bạn.\n\n⚠️ Vòng gọi vốn kín tốt nhất của ATLAS trên gian hàng SWC Field sẽ đóng vào 31/03. Đừng bỏ lỡ!`;
        options.reply_markup.inline_keyboard = ctaButtons;
    }
    else if (data === 'survey_vip') {
        try { await usersCollection.updateOne({ chatId: chatId }, { $set: { tag: 'vip_pass' } }); } catch(e){}
        text = `Chào mừng thành viên VIP! Bạn đã có trong tay vũ khí mạnh nhất của cộng đồng Sky World Community Viet Nam.\n\n👉 Hãy chắc chắn rằng bạn đã tham gia Group Nội Bộ bên dưới để nhận tín hiệu cổ tức mỗi tháng và hướng dẫn truy cập SWC Field.`;
        options.reply_markup.inline_keyboard = [[{ text: "💬 VÀO NHÓM VIP NHẬN TÍN HIỆU", url: GROUP_ZALO_LINK }]];
    }

    // Trả lời lệnh callback để tắt icon loading trên nút
    bot.answerCallbackQuery(query.id);
    // Gửi tin nhắn kết quả
    if(text !== "") {
        bot.sendMessage(chatId, text, options);
    }
});

console.log("🚀 Bot Telegram Sky World Community Viet Nam đã khởi động FULL KỊCH BẢN!");
