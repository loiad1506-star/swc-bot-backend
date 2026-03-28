const TelegramBot = require('node-telegram-bot-api');
const http = require('http');
const url = require('url');
const mongoose = require('mongoose');
const Anthropic = require('@anthropic-ai/sdk');

// ==========================================
// CẤU HÌNH BIẾN MÔI TRƯỜNG
// ==========================================
const token = process.env.BOT_TOKEN;
const mongoURI = process.env.MONGODB_URI;
const claudeApiKey = process.env.CLAUDE_API_KEY;

const bot = new TelegramBot(token, {
polling: {
params: {
allowed_updates: JSON.stringify([
"message", "callback_query", "chat_member", "my_chat_member"
])
}
}
});

const claude = new Anthropic({ apiKey: claudeApiKey });

bot.on("polling_error", (msg) => console.log("⚠️ LỖI POLLING:", msg));
bot.on("error", (msg) => console.log("⚠️ LỖI CHUNG:", msg));

// ==========================================
// HẰNG SỐ CẤU HÌNH
// ==========================================
const ADMIN_ID = process.env.ADMIN_ID || '507318519';
const CHANNEL_USERNAME = '@swc_capital_vn';
const GROUP_USERNAME = '@swc_capital_chat';
const PRIVATE_TG_GROUP = 'https://t.me/swc_vip_internal'; // đổi lại nếu cần
const SWC_PASS_WEB = 'https://swcpass.vn';
const SWC_FIELD_WEB = 'https://swcfield.com/en';
const ACTIVATE_URL = 'https://auth.swcfield.com/en/recover-password';
const VIDEO_MOBILE = 'https://youtu.be/SEB7RJrutxg';
const VIDEO_PC = 'https://www.youtube.com/watch?v=gy_sxh9WCCM';
const DEADLINE = '31/03/2026';

// Tính ngày còn lại động
function getDaysLeft() {
const deadline = new Date('2026-03-31T23:59:00+07:00');
const now = new Date();
const diff = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
return diff > 0 ? diff : 0;
}

// ==========================================
// KẾT NỐI MONGODB
// ==========================================
mongoose.connect(mongoURI, {
useNewUrlParser: true,
useUnifiedTopology: true
})
.then(() => console.log('✅ Đã kết nối MongoDB!'))
.catch(err => console.error('❌ Lỗi MongoDB:', err));

// ==========================================
// SCHEMA NGƯỜI DÙNG
// ==========================================
const userSchema = new mongoose.Schema({
userId: { type: String, unique: true },
firstName: { type: String, default: '' },
lastName: { type: String, default: '' },
username: { type: String, default: '' },
phone: { type: String, default: '' },
email: { type: String, default: '' },
wallet: { type: String, default: '' },
gatecode: { type: String, default: '' },
fullName: { type: String, default: '' },
isPremium: { type: Boolean, default: false },
joinDate: { type: Date, default: Date.now },

// Phân loại khách
tag: {
type: String,
default: 'new',
enum: ['new', 'newbie', 'experienced', 'vip_pass', 'ust_holder']
},

// SWC Pass
swcPassTier: {
type: String,
default: 'none',
enum: ['none', 'essential', 'plus', 'ultimate']
},
swcPassActivatedAt: { type: Date, default: null },
swcPassExpiry: { type: Date, default: null },
ustHolder: { type: Boolean, default: false },

// Funnel
funnelStage: {
type: String,
default: 'new',
enum: ['new', 'interested', 'hot_lead', 'converted']
},
funnelDay: { type: Number, default: 0 },
lastFunnelSent: { type: Date, default: null },

// Ref
referredBy: { type: String, default: null },
referralCount: { type: Number, default: 0 },

// Trạng thái
lastBotInteraction: { type: Date, default: null },
broadcastOptOut: { type: Boolean, default: false },
notes: { type: String, default: '' },

// AI Chat context (lưu 10 tin nhắn gần nhất)
chatHistory: { type: Array, default: [] }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// SYSTEM PROMPT CHO AI (CLAUDE HAIKU)
// ==========================================
function buildSystemPrompt(user) {
const daysLeft = getDaysLeft();
return `Bạn là "Tí" — trợ lý AI tư vấn đầu tư tài chính của quỹ SWC Capital, làm việc dưới quyền anh Hồ Văn Lợi.

TÍNH CÁCH: Chuyên nghiệp, thông tuệ, tự nhiên, dí dỏm — tuyệt đối không giống robot. Xưng "em" hoặc "Tí", gọi khách là "anh/chị" hoặc theo tên nếu biết.

NHIỆM VỤ CỐT LÕI:
- Tư vấn tài chính, đầu tư, trading theo triết lý SWC
- Chốt sale thẻ SWC Pass trước deadline ${DEADLINE} (CÒN ${daysLeft} NGÀY)
- Phân loại khách và dẫn dắt vào đúng gói phù hợp

THÔNG TIN KHÁCH HÀNG HIỆN TẠI:
- Tên: ${user.firstName} ${user.lastName}
- Nhóm: ${user.tag}
- Gói hiện tại: ${user.swcPassTier}
- Funnel stage: ${user.funnelStage}

SẢN PHẨM SWC PASS (3 GÓI):
1. Essential (1 năm): $240/năm hoặc $20/tháng — dành cho người mới
2. Plus (5 năm): $600 hoặc $10/tháng — dành cho người có kinh nghiệm
3. Ultimate (Vĩnh viễn): $2,600 — chỉ 1.000 suất toàn cầu, đóng cửa ${DEADLINE}

LINK QUAN TRỌNG (dùng khi chốt hoặc khi khách hỏi):
- Kích hoạt: ${ACTIVATE_URL}
- Video HD (điện thoại): ${VIDEO_MOBILE}
- Video HD (máy tính): ${VIDEO_PC}
- Website: ${SWC_PASS_WEB}

TRIẾT LÝ ĐẦU TƯ (21 BÀI HỌC CỐT LÕI):
- 5 Tầng chuỗi thức ăn: Chính phủ → Cá voi → Đội lái → Sói già → F0 (thanh khoản)
- Tự trade = tự sát: 95% F0 thua lỗ vì cảm xúc chi phối
- SWC Pass = ủy thác chuyên gia AI Phố Wall, chỉ 10 phút/tháng
- Road to $1M: $240/tháng × lãi kép 15 năm = $1,000,000
- SPV pháp lý: Bảo vệ tài sản qua cấu trúc quỹ quốc tế

QUY TẮC GIAO TIẾP:
- Tin nhắn ngắn gọn, chia đoạn nhỏ, dùng emoji sinh động
- Luôn kết thúc bằng câu hỏi mở để dẫn dắt
- LIÊN TỤC nhắc deadline ${DEADLINE} — còn ${daysLeft} ngày
- Khi khách do dự: dùng FUD (nỗi đau tự trade) + FOMO (khan hiếm Ultimate)
- KHÔNG giải thích dài dòng kỹ thuật — bình dân, dễ hiểu`;
}

// ==========================================
// GỌI AI CLAUDE HAIKU
// ==========================================
async function callClaude(user, userMessage) {
try {
// Giữ tối đa 10 tin nhắn gần nhất
let history = user.chatHistory || [];
history.push({ role: 'user', content: userMessage });
if (history.length > 20) history = history.slice(-20);

const response = await claude.messages.create({
model: 'claude-haiku-4-5',
max_tokens: 600,
system: buildSystemPrompt(user),
messages: history
});

const reply = response.content[0].text;

// Lưu lại history
history.push({ role: 'assistant', content: reply });
user.chatHistory = history;
user.lastBotInteraction = new Date();

// Nâng funnel stage nếu đang tương tác
if (user.funnelStage === 'new') user.funnelStage = 'interested';
if (user.funnelStage === 'interested' && history.length > 6) {
user.funnelStage = 'hot_lead';
}

await user.save();
return reply;

} catch (err) {
console.error('❌ Claude API error:', err.message);
return `Xin lỗi anh/chị, hệ thống đang bận. Vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp đội ngũ SWC nhé! 🙏`;
}
}

// ==========================================
// HÀM GỬI MAIN MENU
// ==========================================
async function sendMainMenu(chatId, messageId = null) {
const daysLeft = getDaysLeft();
const text = `🦁 <b>SWC CAPITAL — HỆ SINH THÁI ĐẦU TƯ TINH ANH</b>

⏳ <b>Còn ${daysLeft} ngày</b> — Gói Ultimate đóng cửa vĩnh viễn lúc 23:59 ngày <b>${DEADLINE}</b>!

Chọn nội dung bạn muốn khám phá:`;

const keyboard = {
inline_keyboard: [
[{ text: "💎 SWC Pass — Tấm Vé Thông Hành", callback_data: 'menu_swcpass' }],
[{ text: "🏢 Dự án ATLAS — BĐS Số Hóa Dubai", callback_data: 'menu_atlas' }],
[{ text: "🗺️ Road to $1M — Lộ Trình Triệu Đô", callback_data: 'road_to_1m' }],
[{ text: "❓ Giải Đáp Thắc Mắc (FAQ)", callback_data: 'menu_faq' }],
[{ text: "🚀 KÍCH HOẠT NGAY TRƯỚC " + DEADLINE, url: ACTIVATE_URL }]
]
};

const options = { parse_mode: 'HTML', reply_markup: keyboard };

if (messageId) {
bot.editMessageText(text, {
chat_id: chatId,
message_id: messageId,
...options
}).catch(() => bot.sendMessage(chatId, text, options));
} else {
bot.sendMessage(chatId, text, options).catch(() => {});
}
}

// ==========================================
// /START — ONBOARDING
// ==========================================
bot.onText(/\/start(.*)/i, async (msg) => {
if (msg.chat.type !== 'private') return;
const chatId = msg.chat.id;
const userId = msg.from.id.toString();
const firstName = msg.from.first_name || '';
const lastName = msg.from.last_name || '';
const username = msg.from.username ? `@${msg.from.username}` : '';

let user = await User.findOne({ userId });
if (!user) {
user = new User({ userId, firstName, lastName, username });
} else {
user.firstName = firstName;
user.lastName = lastName;
user.username = username;
}
await user.save();

if (!user.phone) {
const welcomeMsg = `Xin chào <b>${firstName}</b>! 🦁

Tôi là <b>Tí</b> — trợ lý AI của quỹ <b>SWC Capital</b>.

Để hỗ trợ anh/chị chính xác nhất, vui lòng chia sẻ số điện thoại để bắt đầu nhé! 👇`;

bot.sendMessage(chatId, welcomeMsg, {
parse_mode: 'HTML',
reply_markup: {
keyboard: [[{
text: "📞 Chia sẻ Số điện thoại",
request_contact: true
}]],
resize_keyboard: true,
one_time_keyboard: true
}
}).catch(() => {});
} else {
sendMainMenu(chatId);
}
});

// ==========================================
// XỬ LÝ CONTACT (SĐT)
// ==========================================
bot.on('contact', async (msg) => {
const chatId = msg.chat.id;
const userId = msg.from.id.toString();
const phone = msg.contact.phone_number;

await User.updateOne({ userId }, { $set: { phone } });

bot.sendMessage(chatId, "⏳ Đang thiết lập hồ sơ...", {
reply_markup: { remove_keyboard: true }
}).then(sent => {
bot.deleteMessage(chatId, sent.message_id).catch(() => {});
sendMainMenu(chatId);
});

// Gửi khảo sát sau 15 giây
setTimeout(() => {
const surveyMsg = `👋 Để hỗ trợ anh/chị chính xác nhất, cho Tí biết vị thế hiện tại của mình nhé:`;
bot.sendMessage(chatId, surveyMsg, {
parse_mode: 'HTML',
reply_markup: {
inline_keyboard: [
[{ text: "🙋 Tôi là nhà đầu tư mới", callback_data: 'survey_newbie' }],
[{ text: "💼 Tôi đã có kinh nghiệm đầu tư", callback_data: 'survey_experienced' }],
[{ text: "🔥 Tôi đã có thẻ SWC Pass", callback_data: 'survey_vip' }],
[{ text: "💎 Tôi đang giữ uST", callback_data: 'survey_ust' }]
]
}
}).catch(() => {});
}, 15000);
});

// ==========================================
// CALLBACK QUERY — MENU ĐIỀU HƯỚNG
// ==========================================
bot.on('callback_query', async (callbackQuery) => {
const chatId = callbackQuery.message.chat.id;
const messageId = callbackQuery.message.message_id;
const userId = callbackQuery.from.id.toString();
const data = callbackQuery.data;
const daysLeft = getDaysLeft();

let user = await User.findOne({ userId });
if (!user) return bot.answerCallbackQuery(callbackQuery.id);

bot.answerCallbackQuery(callbackQuery.id).catch(() => {});

let text = '';
let keyboard = [];

const ctaButtons = [
[{ text: `🚀 KÍCH HOẠT NGAY — CÒN ${daysLeft} NGÀY`, url: ACTIVATE_URL }],
[{ text: "🔙 Menu Chính", callback_data: 'main_menu' }]
];

// --- MAIN MENU ---
if (data === 'main_menu') {
return sendMainMenu(chatId, messageId);
}

// --- SWC PASS ---
else if (data === 'menu_swcpass') {
text = `💎 <b>SWC PASS — TẤM VÉ THÔNG HÀNH GIỚI TINH ANH</b>

Không phải khóa học. Không phải tín hiệu trade. Đây là <b>Hệ thống Kỷ luật</b> giúp bạn xây dựng sự giàu có bền vững.

<b>3 GÓI THÀNH VIÊN:</b>

1️⃣ <b>Essential</b> — 1 năm
💰 $240/năm (hoặc $20/tháng)
→ Lý tưởng cho người mới bắt đầu

2️⃣ <b>Plus</b> — 5 năm
💰 $600 (chỉ $10/tháng)
→ Cố định giá, tối ưu dài hạn

3️⃣ <b>Ultimate</b> — Vĩnh viễn 👑
💰 $2,600 — Chỉ <b>1.000 suất toàn cầu</b>
→ Đóng cửa <b>${DEADLINE}</b> — KHÔNG MỞ LẠI

⏳ Còn <b>${daysLeft} ngày</b> để giữ vị thế tốt nhất!`;

keyboard = [
[{ text: "🗺️ Xem Lộ Trình Road to $1M", callback_data: 'road_to_1m' }],
[{ text: "❓ Giải Đáp Thắc Mắc", callback_data: 'menu_faq' }],
...ctaButtons
];
}

// --- ROAD TO $1M ---
else if (data === 'road_to_1m') {
text = `🗺️ <b>ROAD TO $1M — HÀNH TRÌNH TRIỆU ĐÔ</b>

<b>Công thức:</b> Chỉ <b>$240/tháng</b> (~$8/ngày) + Kỷ luật + Lãi kép = <b>$1,000,000 trong 15 năm</b>

<b>Bạn cần làm gì?</b>
✅ Mỗi tháng nhận <b>1 tín hiệu</b>: Mua mã nào, tỷ lệ bao nhiêu
✅ Thực thi trong <b>10–15 phút</b>
✅ Không cần xem chart, không cần phân tích

<b>Tại sao hiệu quả?</b>
→ Chiến lược DCA + Buy & Hold đã được <b>7.000+ người</b> áp dụng
→ AI Phố Wall theo dõi thay bạn 24/7
→ Loại bỏ hoàn toàn cảm xúc — nguyên nhân số 1 khiến F0 thua lỗ

💡 <i>"Khoản đầu tư sinh lời cao nhất là đầu tư vào hệ thống kỷ luật của chính mình"</i>

⏳ Chỉ còn <b>${daysLeft} ngày</b> để bắt đầu hành trình với mức giá ưu đãi!`;

keyboard = [
[{ text: "💎 Xem Chi Tiết Các Gói Pass", callback_data: 'menu_swcpass' }],
...ctaButtons
];
}

// --- ATLAS ---
else if (data === 'menu_atlas') {
text = `🏢 <b>SIÊU DỰ ÁN ATLAS — BĐS SỐ HÓA DUBAI</b>

Sở hữu và giao dịch <b>bất động sản Dubai</b> chỉ bằng vài cú chạm trên điện thoại.

🌟 <b>Điểm nổi bật:</b>
• <b>Thanh khoản 3 giây</b> — phá vỡ sự chậm chạp BĐS truyền thống
• <b>Pháp nhân Atlas Overseas FZE</b> — cấp phép bởi Trung tâm Thương mại Dubai
• <b>Đầu tư từ $50</b> — dân chủ hóa sân chơi giới siêu giàu
• <b>RWA (Real World Assets)</b> — tài sản thật, không phải meme coin

⚠️ Vòng ưu đãi <b>đóng lại ${DEADLINE}</b>. Đừng bỏ lỡ vị thế tốt nhất!`;

keyboard = [
[{ text: "🌐 Khám phá SWC Field", url: SWC_FIELD_WEB }],
...ctaButtons
];
}

// --- FAQ ---
else if (data === 'menu_faq' || data === 'faq_back') {
text = `❓ <b>GIẢI ĐÁP THẮC MẮC PHỔ BIẾN</b>

Chọn câu hỏi bạn đang quan tâm:`;

keyboard = [
[{ text: "1. Nhận được gì ngay sau thanh toán?", callback_data: 'faq_1' }],
[{ text: "2. Road to $1M là gì?", callback_data: 'road_to_1m' }],
[{ text: "3. Khác gì YouTube miễn phí?", callback_data: 'faq_3' }],
[{ text: "4. Chưa có đủ $600 lúc này?", callback_data: 'faq_4' }],
[{ text: "5. Giữ tiền mặt có an toàn không?", callback_data: 'faq_5' }],
[{ text: "🔙 Menu Chính", callback_data: 'main_menu' }]
];
}

else if (data === 'faq_1') {
text = `✅ <b>Nhận được gì ngay sau khi thanh toán?</b>

Quyền truy cập <b>đầy đủ và ngay lập tức</b> vào hệ sinh thái.

Tín hiệu tháng đầu tiên sẽ trong tài khoản của bạn <b>chỉ sau vài phút</b>.

Bạn sẽ biết chính xác: mua mã nào, tỷ lệ bao nhiêu, mua ở giá nào. <b>Không cần chờ đợi!</b>`;
keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], ...ctaButtons];
}

else if (data === 'faq_3') {
text = `✅ <b>Khác gì kiến thức miễn phí YouTube?</b>

Kiến thức miễn phí thì đầy — nhưng nếu chỉ "biết" mà giàu thì ai cũng là triệu phú rồi.

Sự khác biệt nằm ở <b>Hệ thống Kỷ luật ép bạn thực thi</b>, loại bỏ cảm xúc cá nhân.

Giống như đọc sách dạy bơi vs <b>thực sự nhảy xuống hồ với HLV bên cạnh</b>.`;
keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], ...ctaButtons];
}

else if (data === 'faq_4') {
text = `✅ <b>Chưa có đủ $600 lúc này?</b>

Bài toán đơn giản:

$600 ÷ 5 năm = <b>$10/tháng</b> (~250.000 VNĐ)

Số tiền bạn đang ném qua cửa sổ cho cà phê mỗi tuần 😅

Trì hoãn "chờ có đủ tiền" = <b>đánh mất hàng thập kỷ sức mạnh lãi kép</b>. Cái giá thực sự không phải $600 — mà là cơ hội bạn bỏ lỡ.`;
keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], ...ctaButtons];
}

else if (data === 'faq_5') {
text = `✅ <b>Giữ tiền mặt cho an toàn?</b>

Đây là <b>ảo giác an toàn nguy hiểm nhất</b>.

Ngân hàng trung ương in tiền mỗi ngày → lạm phát <b>lặng lẽ móc túi bạn</b> mà không kêu một tiếng.

Giữ tiền mặt dài hạn = <b>đảm bảo 100% bạn sẽ nghèo đi theo thời gian</b>. Giới tinh anh không bao giờ tích trữ tiền mặt dài hạn!`;
keyboard = [[{ text: "🔙 Quay lại FAQ", callback_data: 'faq_back' }], ...ctaButtons];
}

// --- KHẢO SÁT ---
else if (data === 'survey_newbie') {
user.tag = 'newbie';
user.funnelStage = 'interested';
await user.save();
text = `✅ Cảm ơn anh/chị đã chia sẻ!

Là người mới, <b>lạm phát đang âm thầm ăn mòn tiền mặt mỗi ngày</b>. Giải pháp duy nhất là xây dựng cỗ máy dòng tiền tự động.

Gói <b>Essential ($240/năm)</b> là lựa chọn hoàn hảo để bắt đầu — không cần kinh nghiệm, chỉ 10 phút/tháng.

⏳ Còn <b>${daysLeft} ngày</b> để đăng ký với mức giá ưu đãi nhất!`;
keyboard = ctaButtons;
}

else if (data === 'survey_experienced') {
user.tag = 'experienced';
user.funnelStage = 'hot_lead';
await user.save();
text = `✅ Tuyệt vời! Anh/chị là nhà đầu tư có tầm nhìn.

Với kinh nghiệm sẵn có, <b>SWC Field — Private Rounds</b> chính là sân chơi tiếp theo để nhân x lần tài sản.

Gói <b>Plus ($600 / 5 năm)</b> sẽ mở khóa toàn bộ đặc quyền này cho anh/chị.

⚠️ Vòng ưu đãi <b>đóng cửa ${DEADLINE}</b>. Đừng bỏ lỡ!`;
keyboard = ctaButtons;
}

else if (data === 'survey_vip') {
user.tag = 'vip_pass';
user.swcPassTier = 'essential';
user.funnelStage = 'converted';
await user.save();
text = `✅ <b>Chào mừng thành viên VIP!</b>

Anh/chị đã có vũ khí mạnh nhất của hệ sinh thái SWC rồi 💪

Hãy chắc chắn đã tham gia Group nội bộ để <b>nhận tín hiệu cổ tức hàng tháng</b> và cập nhật SWC Field.`;
keyboard = [
[{ text: "💬 Vào Group VIP Nhận Tín Hiệu", url: PRIVATE_TG_GROUP }],
[{ text: "🔙 Menu Chính", callback_data: 'main_menu' }]
];
}

else if (data === 'survey_ust') {
user.tag = 'ust_holder';
user.ustHolder = true;
user.funnelStage = 'hot_lead';
await user.save();
text = `✅ <b>Tầm nhìn của anh/chị hoàn toàn đúng!</b>

Giữ uST là quyết định vĩ mô dài hạn cực kỳ sáng suốt 🎯

Trong lúc chờ IPO bứt phá, <b>SWC Pass là cỗ máy tạo dòng tiền ngay hôm nay</b> — không cần ngồi chờ, không cần tự trade.

Gói <b>Ultimate ($2,600 — Vĩnh viễn)</b> được thiết kế đặc biệt cho những người như anh/chị.

⏳ Chỉ còn <b>${daysLeft} ngày</b> — 1.000 suất, không mở lại!`;
keyboard = ctaButtons;
}

// Render nếu có text
if (text !== '') {
bot.editMessageText(text, {
chat_id: chatId,
message_id: messageId,
parse_mode: 'HTML',
disable_web_page_preview: true,
reply_markup: { inline_keyboard: keyboard }
}).catch(() => {
bot.sendMessage(chatId, text, {
parse_mode: 'HTML',
disable_web_page_preview: true,
reply_markup: { inline_keyboard: keyboard }
});
});
}
});

// ==========================================
// XỬ LÝ TIN NHẮN TỰ DO — AI TƯ VẤN
// ==========================================
bot.on('message', async (msg) => {
if (!msg.from || msg.from.is_bot) return;
if (msg.chat.type !== 'private') return;
if (msg.contact) return; // đã xử lý ở trên
if (msg.text && msg.text.startsWith('/')) return;

const chatId = msg.chat.id;
const userId = msg.from.id.toString();

// --- ADMIN REPLY 2 CHIỀU ---
if (userId === ADMIN_ID && msg.reply_to_message) {
const originalText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
const idMatch = originalText.match(/ID:\s*(\d+)/);
if (idMatch) {
const targetId = idMatch[1];
bot.sendMessage(targetId,
`👨‍💻 <b>Phản hồi từ Đội ngũ Chuyên gia SWC:</b>\n\n${msg.text || msg.caption}`,
{ parse_mode: 'HTML' }
).catch(() => {});
bot.sendMessage(ADMIN_ID, `✅ Đã gửi câu trả lời cho khách ID: <code>${targetId}</code>`, {
parse_mode: 'HTML'
});
return;
}
}

// --- AI TƯ VẤN CHO KHÁCH ---
if (userId !== ADMIN_ID) {
let user = await User.findOne({ userId });
if (!user) {
user = new User({
userId,
firstName: msg.from.first_name || '',
lastName: msg.from.last_name || '',
username: msg.from.username ? `@${msg.from.username}` : ''
});
await user.save();
}

// Typing indicator
bot.sendChatAction(chatId, 'typing').catch(() => {});

// Xử lý ảnh/file — forward cho admin trước
if (msg.photo || msg.video || msg.document) {
await bot.forwardMessage(ADMIN_ID, chatId, msg.message_id).catch(() => {});
}

// Gọi AI
const userText = msg.text || msg.caption || '[Khách gửi file/ảnh]';
const aiReply = await callClaude(user, userText);
bot.sendMessage(chatId, aiReply, { parse_mode: 'HTML' }).catch(() => {});

// Forward cho admin nếu hot_lead hoặc converted
const name = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim();
const uname = msg.from.username ? `@${msg.from.username}` : 'Không có';

if (['hot_lead', 'converted'].includes(user.funnelStage)) {
const alertMsg = `🔥 <b>HOT LEAD — TIN NHẮN MỚI</b>
👤 <b>${name}</b> | ${uname}
🆔 ID: <code>${userId}</code>
🏷 Tag: ${user.tag} | Funnel: ${user.funnelStage}

💬 <b>Khách:</b> ${userText}

👉 <i>Reply tin nhắn này để trả lời khách trực tiếp!</i>`;

bot.sendMessage(ADMIN_ID, alertMsg, {
parse_mode: 'HTML',
reply_markup: {
inline_keyboard: [[{ text: "💬 Chat trực tiếp", url: `tg://user?id=${userId}` }]]
}
}).catch(() => {});
}
}
});

// ==========================================
// BROADCAST TỰ ĐỘNG THEO LỊCH
// ==========================================
function getVNTime() {
const now = new Date();
return new Date(now.getTime() + (7 * 60 * 60 * 1000));
}

async function broadcastToAll(message, options = {}) {
const users = await User.find({ broadcastOptOut: false });
let success = 0;
for (const user of users) {
try {
await bot.sendMessage(user.userId, message, {
parse_mode: 'HTML',
...options
});
success++;
} catch (e) {}
await new Promise(r => setTimeout(r, 50));
}
console.log(`📢 Broadcast xong: ${success}/${users.length} users`);
return success;
}

async function broadcastToTag(tag, message, options = {}) {
const users = await User.find({ tag, broadcastOptOut: false });
let success = 0;
for (const user of users) {
try {
await bot.sendMessage(user.userId, message, {
parse_mode: 'HTML',
...options
});
success++;
} catch (e) {}
await new Promise(r => setTimeout(r, 50));
}
return success;
}

// Kiểm tra giờ mỗi phút
setInterval(async () => {
const vn = getVNTime();
const h = vn.getUTCHours();
const m = vn.getUTCMinutes();
const d = vn.getUTCDay(); // 0=CN, 6=T7
const daysLeft = getDaysLeft();

// 08:00 — Bài sáng (tất cả users)
if (h === 8 && m === 0) {
const msg = `🌅 <b>CHÀO BUỔI SÁNG — THỊ TRƯỜNG HÔM NAY NÓI GÌ?</b>

Trong khi đa số nhà đầu tư F0 đang lo lắng không biết hôm nay thị trường đi đâu...

Thành viên SWC đã có kế hoạch từ đầu tháng. Không cần đoán mò.

💡 <b>Sự thật:</b> 95% người tự trade thua lỗ không phải vì thiếu thông tin — mà vì <b>thiếu hệ thống kỷ luật</b>.

⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ thống tốt nhất trước khi cửa đóng.

👉 ${ACTIVATE_URL}`;

await broadcastToAll(msg, {
reply_markup: {
inline_keyboard: [[{ text: `🚀 KÍCH HOẠT — CÒN ${daysLeft} NGÀY`, url: ACTIVATE_URL }]]
}
});
}

// 12:00 — Tip kiến thức (tất cả)
if (h === 12 && m === 0) {
const tips = [
`💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>5 Tầng chuỗi thức ăn tài chính:</b>\n\n1. Chính phủ/NHTW — Điều tiết lãi suất\n2. Cá voi (Quỹ lớn) — Gom đáy bán đỉnh\n3. Đội lái — Vẽ chart, rũ bỏ\n4. Sói già — Trader kỷ luật\n5. F0 — Thanh khoản cho tầng trên\n\n❓ Bạn đang ở tầng nào?\n\n⏳ SWC Pass giúp bạn <b>nhảy thẳng lên Tầng 2</b> — đứng trên vai Quỹ lớn. Còn ${daysLeft} ngày!`,
`💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>Tại sao RSI phân kỳ nguy hiểm?</b>\n\nKhi giá tạo đỉnh MỚI cao hơn nhưng RSI tạo đỉnh MỚI THẤP HƠN → Lực mua đang kiệt quệ → Cảnh báo sắp sập.\n\nĐây là dấu chân Cá voi đang xả hàng — trong khi F0 vẫn đang hào hứng mua vào.\n\n💎 Thành viên SWC không cần tự đọc chart — AI làm thay. Còn ${daysLeft} ngày!`,
`💡 <b>KIẾN THỨC TÀI CHÍNH HÔM NAY</b>\n\n<b>Lãi kép — Kỳ quan thứ 8 của thế giới</b>\n\n$240/tháng × 15 năm × lãi kép 20%/năm = <b>$1,000,000+</b>\n\nBí quyết không phải là số tiền lớn — mà là <b>bắt đầu SỚM và kỷ luật ĐỀU ĐẶN</b>.\n\nMỗi ngày trì hoãn = mất đi một phần sức mạnh lãi kép. Còn ${daysLeft} ngày!`
];
const tip = tips[Math.floor(Math.random() * tips.length)];
await broadcastToAll(tip, {
reply_markup: {
inline_keyboard: [[{ text: `💎 Xem Gói SWC Pass`, callback_data: 'menu_swcpass' }]]
}
});
}

// 19:30 — Kéo vào group (tất cả)
if (h === 19 && m === 30) {
const msg = `📚 <b>THỜI GIAN CẬP NHẬT TIN TỨC & KIẾN THỨC TÀI CHÍNH!</b>

Vào Group cộng đồng ngay để:
✅ Cập nhật tin tức mới nhất về SWC Field
✅ Thảo luận chiến lược đầu tư
✅ Kết nối với hơn 1.000+ nhà đầu tư tinh anh

⏳ Còn <b>${daysLeft} ngày</b> để gia nhập hệ sinh thái với giá tốt nhất!`;

await broadcastToAll(msg, {
reply_markup: {
inline_keyboard: [
[{ text: "💬 Vào Group Thảo Luận Ngay", url: `https://t.me/${GROUP_USERNAME.replace('@', '')}` }],
[{ text: `🚀 Kích Hoạt SWC Pass`, url: ACTIVATE_URL }]
]
}
});
}

// 20:30 — FOMO chốt sale (hot leads)
if (h === 20 && m === 30) {
const msg = `🔥 <b>NHẮC NHỞ KHẨN — CÒN ${daysLeft} NGÀY!</b>

Lúc này có 2 loại người:

Loại 1: Đang ngồi phân tích chart, lo lắng không biết thị trường đi đâu...

Loại 2: Đã có SWC Pass — <b>đang ngủ ngon trong khi port tự chạy</b>.

Bạn muốn là loại nào?

Gói <b>Ultimate (Vĩnh viễn)</b> — 1.000 suất — <b>đóng cửa ${DEADLINE}</b>.

Sau ngày đó? Không ngoại lệ. Không "để tôi hỏi thêm."

👉 ${ACTIVATE_URL}`;

await broadcastToTag('hot_lead', msg, {
reply_markup: {
inline_keyboard: [[{ text: `⚡ KÍCH HOẠT NGAY — CÒN ${daysLeft} NGÀY`, url: ACTIVATE_URL }]]
}
});
// Cũng gửi cho interested
await broadcastToTag('interested', msg, {
reply_markup: {
inline_keyboard: [[{ text: `⚡ KÍCH HOẠT NGAY — CÒN ${daysLeft} NGÀY`, url: ACTIVATE_URL }]]
}
});
}

// 21:00 — Nội dung VIP cho uST holders và Pass holders
if (h === 21 && m === 0) {
const vipUsers = await User.find({
$or: [{ ustHolder: true }, { swcPassTier: { $ne: 'none' } }],
broadcastOptOut: false
});

if (vipUsers.length > 0) {
const vipMsg = `💎 <b>CẬP NHẬT NỘI BỘ — DÀNH RIÊNG CHO THÀNH VIÊN VIP</b>

Tuần này thị trường đang trong giai đoạn tích lũy. Đây là thời điểm <b>Cá voi âm thầm gom hàng</b> — không phải lúc hoảng loạn bán ra.

Tín hiệu tháng tới sẽ được cập nhật sớm trong hệ thống.

Anh/chị đang đi đúng hướng. Giữ vững Vị thế! 💪

👉 Truy cập tài khoản: ${ACTIVATE_URL}`;

for (const user of vipUsers) {
try {
await bot.sendMessage(user.userId, vipMsg, { parse_mode: 'HTML' });
} catch (e) {}
await new Promise(r => setTimeout(r, 50));
}
}
}

}, 60000);

// ==========================================
// FUNNEL DRIP — CHẠY MỖI GIỜ
// ==========================================
const funnelMessages = [
null, // Ngày 0 — bỏ qua (mới join)
// Ngày 1
`📖 <b>BÀI HỌC SỐ 1: TẠI SAO 95% NHÀ ĐẦU TƯ THUA LỖ?</b>

Không phải vì thiếu thông tin. Không phải vì thị trường xấu.

Mà vì họ đang chơi trò chơi mà <b>luật do người khác viết</b>.

5 tầng chuỗi thức ăn tài chính:
🏛️ Chính phủ → 🐋 Cá voi → 🎰 Đội lái → 🐺 Sói già → 😵 F0

<b>F0 (Tầng 5) = Thanh khoản cho tất cả tầng trên.</b>

Mỗi lần bạn mua vào hoảng loạn hay bán ra sợ hãi — đó là lúc Cá voi đang ăn tiền của bạn.

💡 Giải pháp duy nhất: Đừng chơi một mình. Hãy đứng trên vai Quỹ lớn.

<i>→ Đó là lý do SWC Pass tồn tại.</i>`,

// Ngày 2
`📖 <b>BÀI HỌC SỐ 2: TIỀN NHÀN RỖI LÀ GÌ?</b>

Có một nguyên tắc bất di bất dịch:

<b>TUYỆT ĐỐI không đầu tư bằng tiền "cơm áo gạo tiền".</b>

Chỉ dùng tiền nhàn rỗi — tiền mà dù mất đi hôm nay, cuộc sống của bạn không thay đổi.

Đây là lý do hầu hết F0 thua lỗ: họ dùng tiền học phí, tiền thuê nhà, tiền vay để "đánh nhanh rút gọn."

Kết quả? Không dám cắt lỗ → Gồng lỗ → Cháy tài khoản → Nợ nần.

💡 SWC Pass bắt đầu từ <b>$8/ngày (~240k VNĐ)</b> — đúng nghĩa tiền nhàn rỗi.`,

// Ngày 3
`📖 <b>BÀI HỌC SỐ 3: SỨC MẠNH LÃI KÉP</b>

Einstein gọi đây là "Kỳ quan thứ 8 của thế giới."

<b>$240/tháng × kỷ luật × 15 năm = $1,000,000</b>

Không phải may mắn. Không phải tài năng. Chỉ là <b>toán học + thời gian + kỷ luật</b>.

Vấn đề của đa số: Họ không bắt đầu sớm. Họ cứ chờ "đúng thời điểm."

💡 <b>Thời điểm tốt nhất là 10 năm trước. Thời điểm tốt thứ 2 là HÔM NAY.</b>

⏳ Còn {DAYS} ngày để bắt đầu với mức giá ưu đãi nhất!`,

// Ngày 4 — FOMO
`🔥 <b>CÒN {DAYS} NGÀY — ĐÃ CÓ BAO NHIÊU NGƯỜI ĐĂNG KÝ RỒI?</b>

Gói Ultimate (Vĩnh viễn) — 1.000 suất toàn cầu.

Khi 1.000 suất đầy → cửa đóng vĩnh viễn. Không mở lại. Không ngoại lệ.

Người đăng ký hôm nay đang <b>khóa giá vĩnh viễn</b> trong khi giá thị trường chỉ có một chiều: đi lên.

<b>Câu hỏi không phải "Có nên mua không?" — mà là "Bao giờ thì quá muộn?"</b>

👉 ${ACTIVATE_URL}`,

// Ngày 5 — Social proof
`💬 <b>HỌ ĐÃ THAY ĐỔI NHƯ THẾ NÀO SAU KHI DÙNG SWC PASS?</b>

<i>"Trước đây tôi dành 3-4 tiếng mỗi ngày xem chart, vẫn thua lỗ. Giờ 10 phút/tháng, danh mục đang tăng trưởng đều đặn."</i>

<i>"Tôi không còn mất ngủ vì thị trường biến động nữa. Hệ thống đang chạy thay tôi."</i>

<i>"$240/tháng mà tôi xây dựng được kế hoạch rõ ràng đến $1M. Trước đây tôi không nghĩ điều này có thể."</i>

💡 Đây không phải may mắn. Đây là <b>hệ thống đúng + kỷ luật đúng</b>.

⏳ Còn {DAYS} ngày — Anh/chị sẵn sàng chưa?`,

// Ngày 6 — Chốt
`⚡ <b>NGÀY MAI LÀ NGÀY CUỐI CÙNG!</b>

Anh/chị đã theo dõi thông tin SWC trong nhiều ngày.

Đây là lúc đưa ra quyết định.

<b>2 lựa chọn:</b>

❌ Tiếp tục tự trade → Tiếp tục mất thời gian + tiền bạc + sức khỏe tâm thần

✅ SWC Pass → 10 phút/tháng, đứng trên vai Quỹ lớn, dòng tiền nhàn rỗi

Gói Ultimate đóng cửa <b>${DEADLINE}</b>. Sau đó giá sẽ cao hơn — hoặc không còn suất nữa.

<b>Quyết định hôm nay định hình 15 năm tới của anh/chị.</b>

👉 ${ACTIVATE_URL}`,

// Ngày 7 — Ngày cuối
`🚨 <b>HÔM NAY LÀ NGÀY CUỐI CÙNG!</b>

23:59 tối nay — cửa đóng.

Không phải "sắp đóng." Không phải "sẽ mở lại sau." <b>ĐÓNG VĨNH VIỄN.</b>

Nếu anh/chị đang đọc tin này — còn kịp.

Nếu anh/chị đọc tin này vào ngày mai — sẽ không còn kịp nữa.

👉 <b>KÍCH HOẠT NGAY:</b>
${ACTIVATE_URL}

📺 Hướng dẫn (điện thoại): ${VIDEO_MOBILE}
💻 Hướng dẫn (máy tính): ${VIDEO_PC}`
];

setInterval(async () => {
try {
const now = new Date();
const daysLeft = getDaysLeft();

// Lấy users đang trong funnel (chưa convert, chưa opt-out)
const funnelUsers = await User.find({
funnelStage: { $in: ['interested', 'hot_lead'] },
broadcastOptOut: false,
lastFunnelSent: {
$lt: new Date(now.getTime() - 20 * 60 * 60 * 1000) // Chưa gửi trong 20h
}
});

for (const user of funnelUsers) {
const day = Math.min(user.funnelDay + 1, funnelMessages.length - 1);
let msgTemplate = funnelMessages[day];
if (!msgTemplate) continue;

// Thay thế placeholder
const msg = msgTemplate.replace(/{DAYS}/g, daysLeft);

try {
await bot.sendMessage(user.userId, msg, {
parse_mode: 'HTML',
reply_markup: {
inline_keyboard: [[{
text: `🚀 Kích Hoạt SWC Pass — Còn ${daysLeft} Ngày`,
url: ACTIVATE_URL
}]]
}
});
user.funnelDay = day;
user.lastFunnelSent = now;
await user.save();
} catch (e) {}

await new Promise(r => setTimeout(r, 100));
}
} catch (e) {
console.error('Funnel error:', e.message);
}
}, 60 * 60 * 1000); // Chạy mỗi 60 phút

// ==========================================
// ADMIN COMMANDS
// ==========================================

// /admin hoặc /menu
bot.onText(/\/(admin|menu)/i, async (msg) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
bot.sendMessage(msg.chat.id, `👨‍💻 <b>ADMIN PANEL — SWC BOT v2.0</b>`, {
parse_mode: 'HTML',
reply_markup: {
inline_keyboard: [
[{ text: "📊 Thống kê hệ thống", callback_data: 'admin_stats' }],
[{ text: "📢 Hướng dẫn Broadcast", callback_data: 'admin_help' }]
]
}
});
});

// /stats
bot.onText(/\/stats/i, async (msg) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
const total = await User.countDocuments();
const newbie = await User.countDocuments({ tag: 'newbie' });
const experienced = await User.countDocuments({ tag: 'experienced' });
const vip = await User.countDocuments({ tag: 'vip_pass' });
const ust = await User.countDocuments({ ustHolder: true });
const interested = await User.countDocuments({ funnelStage: 'interested' });
const hotLead = await User.countDocuments({ funnelStage: 'hot_lead' });
const converted = await User.countDocuments({ funnelStage: 'converted' });
const daysLeft = getDaysLeft();

const report = `📊 <b>THỐNG KÊ HỆ THỐNG SWC BOT</b>

👥 <b>Tổng users:</b> ${total}
⏳ <b>Còn lại:</b> ${daysLeft} ngày đến ${DEADLINE}

<b>Phân loại:</b>
• 🙋 Người mới: ${newbie}
• 💼 Có kinh nghiệm: ${experienced}
• 🔥 Đã có Pass: ${vip}
• 💎 Giữ uST: ${ust}

<b>Funnel:</b>
• 🌱 Interested: ${interested}
• 🔥 Hot Lead: ${hotLead}
• ✅ Converted: ${converted}`;

bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
});

// /tracuu [id]
bot.onText(/\/tracuu (\d+)/i, async (msg, match) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
const targetId = match[1];
const user = await User.findOne({ userId: targetId });
if (!user) return bot.sendMessage(ADMIN_ID, `❌ Không tìm thấy ID: <code>${targetId}</code>`, { parse_mode: 'HTML' });

const report = `🔎 <b>HỒ SƠ KHÁCH HÀNG</b>
🆔 ID: <code>${targetId}</code>
👤 Tên: ${user.firstName} ${user.lastName}
🔗 Username: ${user.username || 'Không có'}
📞 SĐT: ${user.phone || 'Chưa có'}
📧 Email: ${user.email || 'Chưa có'}
🏷 Tag: ${user.tag}
🎯 Funnel: ${user.funnelStage} (Ngày ${user.funnelDay})
💎 SWC Pass: ${user.swcPassTier}
💰 uST Holder: ${user.ustHolder ? 'Có' : 'Không'}
📅 Tham gia: ${new Date(user.joinDate).toLocaleString('vi-VN')}
📝 Ghi chú: ${user.notes || 'Trống'}

👉 <a href="tg://user?id=${targetId}">Nhắn tin trực tiếp</a>`;

bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
});

// /addnote [id] [ghi chú]
bot.onText(/\/addnote (\d+) ([\s\S]+)/i, async (msg, match) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
await User.updateOne({ userId: match[1] }, { $set: { notes: match[2] } });
bot.sendMessage(ADMIN_ID, `✅ Đã lưu ghi chú cho ID: <code>${match[1]}
// /setpass [userId] [tier]
bot.onText(/\/setpass (\d+) (\w+)/i, async (msg, match) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
const validTiers = ['none', 'essential', 'plus', 'ultimate'];
const tier = match[2].toLowerCase();
if (!validTiers.includes(tier)) {
return bot.sendMessage(ADMIN_ID, `❌ Tier không hợp lệ. Dùng: none / essential / plus / ultimate`);
}
await User.updateOne({ userId: match[1] }, {
$set: {
swcPassTier: tier,
funnelStage: tier !== 'none' ? 'converted' : 'hot_lead',
swcPassActivatedAt: tier !== 'none' ? new Date() : null
}
});
bot.sendMessage(ADMIN_ID, `✅ Đã cập nhật SWC Pass cho ID <code>${match[1]}</code> → <b>${tier}</b>`, { parse_mode: 'HTML' });
});

// /sendall [nội dung]
bot.onText(/\/sendall ([\s\S]+)/i, async (msg, match) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
const content = match[1];
const users = await User.find({});
bot.sendMessage(ADMIN_ID, `⏳ Đang gửi cho ${users.length} users...`);
let success = 0;
for (const u of users) {
try {
await bot.sendMessage(u.userId, content, { parse_mode: 'HTML' });
success++;
} catch (e) {}
await new Promise(r => setTimeout(r, 50));
}
bot.sendMessage(ADMIN_ID, `✅ Đã gửi thành công: ${success}/${users.length}`);
});

// /sendtag [tag] [nội dung]
bot.onText(/\/sendtag (\w+) ([\s\S]+)/i, async (msg, match) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
const tag = match[1];
const content = match[2];
const users = await User.find({ tag });
bot.sendMessage(ADMIN_ID, `⏳ Đang gửi cho ${users.length} users tag [${tag}]...`);
let success = 0;
for (const u of users) {
try {
await bot.sendMessage(u.userId, content, { parse_mode: 'HTML' });
success++;
} catch (e) {}
await new Promise(r => setTimeout(r, 50));
}
bot.sendMessage(ADMIN_ID, `✅ Đã gửi: ${success}/${users.length}`);
});

// /sendto [userId] [nội dung]
bot.onText(/\/sendto (\d+) ([\s\S]+)/i, async (msg, match) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
try {
await bot.sendMessage(match[1],
`👨‍💻 <b>THÔNG BÁO TỪ ĐỘI NGŨ CHUYÊN GIA SWC:</b>\n\n${match[2]}`,
{ parse_mode: 'HTML' }
);
bot.sendMessage(ADMIN_ID, `✅ Đã gửi tới ID: <code>${match[1]}</code>`, { parse_mode: 'HTML' });
} catch (e) {
bot.sendMessage(ADMIN_ID, `❌ Không gửi được — khách đã block bot.`);
}
});

// /sendgroup [nội dung]
bot.onText(/\/sendgroup ([\s\S]+)/i, async (msg, match) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
try {
await bot.sendMessage(GROUP_USERNAME,
`📢 <b>THÔNG BÁO TỪ ĐỘI NGŨ SWC:</b>\n\n${match[1]}`,
{ parse_mode: 'HTML' }
);
bot.sendMessage(ADMIN_ID, `✅ Đã gửi lên Group!`);
} catch (e) {
bot.sendMessage(ADMIN_ID, `❌ Lỗi: ${e.message}`);
}
});

// /export — xuất danh sách hot leads
bot.onText(/\/export/i, async (msg) => {
if (msg.from.id.toString() !== ADMIN_ID) return;
const hotLeads = await User.find({
funnelStage: { $in: ['hot_lead', 'interested'] }
}).limit(50);

if (hotLeads.length === 0) {
return bot.sendMessage(ADMIN_ID, `📭 Chưa có hot lead nào.`);
}

let report = `🔥 <b>DANH SÁCH HOT LEADS (${hotLeads.length} người)</b>\n\n`;
hotLeads.forEach((u, i) => {
report += `${i + 1}. <b>${u.firstName} ${u.lastName}</b> | <code>${u.userId}</code> | ${u.tag} | ${u.phone || 'Chưa có SĐT'}\n`;
});

bot.sendMessage(ADMIN_ID, report, { parse_mode: 'HTML' });
});

// ==========================================
// HTTP SERVER (giữ Render không sleep)
// ==========================================
const server = http.createServer((req, res) => {
res.writeHead(200, { 'Content-Type': 'text/plain' });
res.end('SWC Bot v2.0 — Running OK');
});

server.listen(process.env.PORT || 3000, () => {
console.log(`🌐 HTTP server running on port ${process.env.PORT || 3000}`);
});

console.log('🚀 SWC Capital Bot v2.0 — AI Powered by Claude Haiku — Đã khởi động!');
