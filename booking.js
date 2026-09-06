const axios = require('axios');
const qs = require('qs');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

// নতুন ডাক্তারের লিংক অনুযায়ী এপিআই ও রেফারার আপডেট করা হয়েছে
const API_URL = 'http://210.4.73.10:52/appointments/trust_apt_pub/appointment';
const PAGE_URL = 'http://210.4.73.10:52/appointments/apps/appointment/1427/13003';
const CHAMBER_ID = '1427'; // নতুন ডাক্তারের চেম্বার আইডি

const CONFIG = {
  intervalMinutes: 1,
  patients: [
    { name: "Rabbi", phone: "01927375671" },
    { name: "Ayesha Khatun", phone: "01947673671" }
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

// HTML থেকে ক্লিন টেক্সট বের করার ফাংশন
function cleanHtmlText(html) {
  return html
    .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, '')
    .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

// অ্যাপয়েন্টমেন্টের তারিখ বের করার লজিক (আগামীকালের তারিখ)
function getAppointmentDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

async function runDirectBooking() {
  await sendTelegramMsg(`🚀 *Direct API Booking Started for Doctor 1427!*\n\n📍 *Link:* ${PAGE_URL}`);

  const aptDate = getAppointmentDate();

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialJobNum = i + 1;

    try {
      const postData = qs.stringify({
        'averageTime': '5',
        'contact2': '28, Doyagonj,Gandaria',
        'chamber_id': CHAMBER_ID, // আপডেটকৃত চেম্বার আইডি
        'appointment_date': aptDate,
        'pat_name': patient.name,
        'pat_contact': patient.phone,
        'sample': ''
      });

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

      const rawHtml = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data);
      const cleanText = cleanHtmlText(rawHtml);

      // সফলতা যাচাই
      if (rawHtml.includes("Appointment successfully created") || rawHtml.includes("Serial:")) {
        
        let serialNo = "Not Found";
        const serialMatch = cleanText.match(/Serial:\s*(\d+)/i);
        if (serialMatch && serialMatch[1]) {
          serialNo = serialMatch[1];
        }

        let fullAppointmentMsg = "";
        const msgMatch = cleanText.match(/Appointment Doyagonj[\s\S]*?(?=Hotline|New Apps|$)/i);
        if (msgMatch) {
          fullAppointmentMsg = msgMatch[0].replace(/\n+/g, ' ').trim();
        } else {
          const generalMatch = cleanText.match(/Appointment successfully created[\s\S]*?(?=Hotline|$)/i);
          if (generalMatch) fullAppointmentMsg = generalMatch[0].replace(/\n+/g, ' ').trim();
        }

        const telegramMessage = 
          `✅ *Appointment Successfully Created!*\n\n` +
          `👤 *Patient:* ${patient.name}\n` +
          `📞 *Phone:* ${patient.phone}\n` +
          `🎫 *Serial Number:* \`${serialNo}\`\n\n` +
          `📝 *Full Confirmation Message:*\n` +
          `\`\`\`\n` +
          `Appointment Form\n` +
          `Appointment successfully created.\n` +
          `May Allah keep you healthy.\n\n` +
          `${fullAppointmentMsg || "Appointment details processed."}\n` +
          `\`\`\``;

        await sendTelegramMsg(telegramMessage);

      } else if (rawHtml.includes("Problems")) {
        await sendTelegramMsg(
          `❌ *Job ${serialJobNum} Failed for ${patient.name}*\n\n` +
          `⚠️ *Result:* Problems (Serial Full or Booking Closed)`
        );
      } else {
        await sendTelegramMsg(
          `ℹ️ *Job ${serialJobNum} Response:*\n\`\`\`\n${cleanText.slice(0, 300)}\n\`\`\``
        );
      }

    } catch (error) {
      await sendTelegramMsg(`❌ *Job ${serialJobNum} Error:* ${error.message}`);
    }

    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await sendTelegramMsg(`🎉 *All 5 Appointments Executed!*`);
}

runDirectBooking();
