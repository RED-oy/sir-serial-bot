const axios = require('axios');
const qs = require('qs');
const { chromium } = require('playwright');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const API_URL = 'http://210.4.73.10:52/appointments/trust_apt_pub/appointment';
const PAGE_URL = 'http://210.4.73.10:52/appointments/apps/appointment/1424/13000';

const CONFIG = {
  intervalMinutes: 1,
  patients: [
    { name: "Rabbi", phone: "01927375671" },
    { name: "Md Karim", phone: "01800000002" },
    { name: "Sultana Begum", phone: "01900000003" },
    { name: "Rafiqul Islam", phone: "01700000004" },
    { name: "Ayesha Khatun", phone: "01500000005" }
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

async function sendTelegramPhoto(imageBuffer, caption) {
  try {
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', CHAT_ID);
    form.append('photo', imageBuffer, { filename: 'result.png' });
    form.append('caption', caption);

    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
      headers: form.getHeaders()
    });
  } catch (err) {
    console.error("Photo Error:", err.message);
  }
}

function getAppointmentDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

async function runPerfectBooking() {
  await sendTelegramMsg(`🚀 *100% Accurate Booking Engine Started!*`);

  const aptDate = getAppointmentDate();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  const page = await context.newPage();

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialJobNum = i + 1;

    try {
      const postData = qs.stringify({
        'averageTime': '5',
        'contact2': '28, Doyagonj,Gandaria',
        'chamber_id': '1424',
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

      // রেসপন্স অবজেক্ট হলে তাকে স্ট্রিংয়ে রূপান্তর (Fix for .includes issue)
      const responseHtml = typeof response.data === 'object' 
        ? JSON.stringify(response.data) 
        : String(response.data);

      // রেজাল্ট পেজের স্ক্রিনশট নেওয়া
      await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2000);
      const screenshot = await page.screenshot({ fullPage: true });

      // কনফার্মেশন যাচাই
      if (responseHtml.includes("Appointment successfully created") || responseHtml.includes("Serial:")) {
        
        let serialNo = "Detected";
        const serialMatch = responseHtml.match(/Serial:\s*(\d+)/i);
        if (serialMatch && serialMatch[1]) serialNo = serialMatch[1];

        const caption = `✅ *Job ${serialJobNum} SUCCESSFUL!*\n\n` +
          `👤 *Name:* ${patient.name}\n` +
          `📞 *Phone:* ${patient.phone}\n` +
          `🎫 *Serial Number:* \`${serialNo}\`\n` +
          `📅 *Date:* ${aptDate}`;

        await sendTelegramPhoto(screenshot, caption);

      } else {
        const caption = `❌ *Job ${serialJobNum} FAILED / SLOT FULL*\n\n` +
          `👤 *Name:* ${patient.name}\n` +
          `📞 *Phone:* ${patient.phone}\n` +
          `⚠️ *Result:* Problems (No Slot Available or Closed)`;

        await sendTelegramPhoto(screenshot, caption);
      }

    } catch (error) {
      await sendTelegramMsg(`❌ *Job ${serialJobNum} Error:* ${error.message}`);
    }

    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await browser.close();
  await sendTelegramMsg(`🎉 *All 5 Appointments Executed!*`);
}

runPerfectBooking();
