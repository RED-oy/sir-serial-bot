const axios = require('axios');
const qs = require('qs');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

// API Configurations
const API_URL = 'http://210.4.73.10:52/appointments/trust_apt_pub/appointment';
const PAGE_URL = 'http://210.4.73.10:52/appointments/apps/appointment/1427/13003';
const CHAMBER_ID = '1427';

// Testing-এর জন্য আপনার দেওয়া কাস্টম তারিখ (২০২৬-০৯-০৮) এবং নম্বর সেট করা হলো
const TARGET_DATE = '2026-09-08'; 

const CONFIG = {
  intervalMinutes: 1,
  patients: [
    { name: "Rabbi", phone: "01947673671" } // কনফার্মেশনের জন্য আপনার আসল মোবাইল নম্বর
  ]
};

async function sendTelegramMsg(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: text,
      parse_mode: 'Markdown'
    });
  } catch (err) {
    console.error("Telegram Error:", err.message);
  }
}

async function runRealApiBooking() {
  await sendTelegramMsg(`🚀 *100% Real API Booking Engine Started!*`);

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialJobNum = i + 1;

    try {
      const postData = qs.stringify({
        'averageTime': '5',
        'contact2': '28, Doyagonj,Gandaria',
        'chamber_id': CHAMBER_ID,
        'appointment_date': TARGET_DATE,
        'pat_name': patient.name,
        'pat_contact': patient.phone,
        'sample': ''
      });

      // আসল ব্যাকএন্ড রিকোয়েস্ট
      const response = await axios.post(API_URL, postData, {
        headers: {
          'Host': '210.4.73.10:52',
          'Connection': 'keep-alive',
          'Accept': '*/*',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Origin': 'http://210.4.73.10:52',
          'Referer': PAGE_URL,
          'Accept-Encoding': 'gzip, deflate',
          'Accept-Language': 'en-BD,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });

      const resData = response.data;

      // আসল JSON রেসপন্স পার্সিং
      if (resData && (resData.apt_status === true || resData.status === 200) && resData.message) {
        
        const details = resData.message;
        const serialNo = details.serial || 'N/A';
        const roomNo = details.roomNo || 'N/A';
        const doctorName = details.nickName || 'Dr.';
        const timeSlot = details.Time || '';
        const msgFormat = details.messageFormat || '';

        const telegramMessage = 
          `✅ *REAL APPOINTMENT SUCCESSFUL!*\n\n` +
          `👤 *Patient Name:* ${patient.name}\n` +
          `📞 *Phone Number:* \`${patient.phone}\`\n` +
          `🎫 *Serial Number:* \`${serialNo}\`\n` +
          `🚪 *Room No:* ${roomNo}\n` +
          `⏰ *Time Slot:* ${timeSlot}\n` +
          `📅 *Date:* ${TARGET_DATE}\n\n` +
          `💬 *Server Confirmation SMS Text:*\n` +
          `\`\`\`\n${msgFormat}\n\`\`\``;

        await sendTelegramMsg(telegramMessage);

      } else {
        // স্লট না থাকলে বা সার্ভার রিজেক্ট করলে
        const errorMsg = typeof resData === 'object' ? JSON.stringify(resData) : String(resData);
        await sendTelegramMsg(
          `❌ *Booking Failed for ${patient.name}*\n\n` +
          `⚠️ *Server Response:* \`\`\`${errorMsg}\`\`\``
        );
      }

    } catch (error) {
      await sendTelegramMsg(`❌ *Job ${serialJobNum} Network Error:* ${error.message}`);
    }

    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await sendTelegramMsg(`🎉 *Test Appointment Execution Complete!*`);
}

runRealApiBooking();
