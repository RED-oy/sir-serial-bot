const { chromium } = require('playwright');
const axios = require('axios');

// আপনার বটের টোকেন এবং চ্যাট আইডি সেট করা হলো
const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

// ডিফল্ট সেটআপ
const CONFIG = {
  url: 'http://210.4.73.10:52/appointments/apps/appointment/1460/13030',
  intervalMinutes: 1, // ১ মিনিট পর পর
  patients: [
    { name: "Md Rahim", phone: "01700000001", type: "New", gender: "Male" },
    { name: "Md Karim", phone: "01800000002", type: "New", gender: "Male" },
    { name: "Sultana Begum", phone: "01900000003", type: "Old", gender: "Female" },
    { name: "Rafiqul Islam", phone: "01700000004", type: "New", gender: "Male" },
    { name: "Ayesha Khatun", phone: "01500000005", type: "Old", gender: "Female" }
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
    form.append('photo', imageBuffer, { filename: 'screenshot.png' });
    form.append('caption', caption);

    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, form, {
      headers: form.getHeaders()
    });
  } catch (err) {
    console.error("Photo Send Error:", err.message);
  }
}

async function runBooking() {
  await sendTelegramMsg(`🤖 *Auto Serial Booking Started!*\n\n📍 *Link:* ${CONFIG.url}\n👥 *Total Patients:* ${CONFIG.patients.length}\n⏱️ *Interval:* ${CONFIG.intervalMinutes} Minute(s)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialNum = i + 1;

    try {
      await page.goto(CONFIG.url, { waitUntil: 'networkidle', timeout: 45000 });

      // ইনপুট ফর্ম ফিলআপ
      await page.fill('input[name="patient_name"], input[placeholder*="Name"], #name', patient.name);
      await page.fill('input[name="mobile"], input[placeholder*="Mobile"], #mobile', patient.phone);

      // টাইপ এবং জেন্ডার ড্রপডাউন সিলেক্ট
      await page.selectOption('select[name="patient_type"], #type', { label: patient.type });
      await page.selectOption('select[name="gender"], #gender', { label: patient.gender });

      // সাবমিট বাটন ক্লিক
      await page.click('button[type="submit"], input[type="submit"]');
      await page.waitForTimeout(4000);

      // রেজাল্ট পেজের স্ক্রিনশট নেওয়া
      const screenshot = await page.screenshot({ fullPage: false });
      
      await sendTelegramPhoto(
        screenshot,
        `✅ *Serial ${serialNum} Submitted!*\n\n👤 *Name:* ${patient.name}\n📞 *Phone:* ${patient.phone}\n🏷️ *Type:* ${patient.type} | *Gender:* ${patient.gender}`
      );

    } catch (error) {
      await sendTelegramMsg(`❌ *Serial ${serialNum} Failed for ${patient.name}*\n\n*Error:* ${error.message}`);
    }

    // শেষ রোগী না হলে ১ মিনিট মেপে ওয়েট করবে
    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await browser.close();
  await sendTelegramMsg(`🎉 *All ${CONFIG.patients.length} Serials Processing Completed!*`);
}

runBooking();
