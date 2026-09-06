const { chromium } = require('playwright');
const axios = require('axios');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const CONFIG = {
  url: 'http://210.4.73.10:52/appointments/apps/appointment/1460/12999',
  intervalMinutes: 1,
  patients: [
    { name: "Md Rahim", phone: "01947673671", type: "New", gender: "Male" },
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
  await sendTelegramMsg(`🤖 *Auto Serial Booking Started!*\n\n📍 *Link:* ${CONFIG.url}`);

  // ব্রাউজার রেজোলিউশন সঠিক করে দেওয়া হয়েছে যেন স্ক্রিনশট সাদা/ব্ল্যাংক না আসে
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 820 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialNum = i + 1;

    try {
      // ১. পেজ লোড হওয়া পর্যন্ত অপেক্ষা
      await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(5000); // পেজের জাভাস্ক্রিপ্ট লোড হওয়ার জন্য ৫ সেকেন্ড পজ

      // ২. ইনপুট ফিল্ড দৃশ্যমান না হওয়া পর্যন্ত ওয়েট করা
      const inputField = page.locator('input').first();
      await inputField.waitFor({ state: 'visible', timeout: 20000 });

      // ৩. ফর্ম পূরণ (সরাসরি ফিল্ড খুঁজে টাইপ করা)
      const inputs = await page.$$('input[type="text"], input[type="tel"], input:not([type])');
      if (inputs.length >= 2) {
        await inputs[0].fill(patient.name);
        await inputs[1].fill(patient.phone);
      } else {
        await page.fill('input[name*="name" i], input[placeholder*="name" i]', patient.name);
        await page.fill('input[name*="mobile" i], input[placeholder*="mobile" i]', patient.phone);
      }

      // ৪. টাইপ এবং জেন্ডার ড্রপডাউন সিলেক্ট
      const selects = await page.$$('select');
      if (selects.length >= 2) {
        await selects[0].selectOption({ label: patient.type }).catch(() => {});
        await selects[1].selectOption({ label: patient.gender }).catch(() => {});
      }

      await page.waitForTimeout(1000);

      // ৫. সাবমিট করার আগের পেজের স্ক্রিনশট (ফর্ম ফিলআপ ঠিকমত হয়েছে কিনা দেখার জন্য)
      const filledScreenshot = await page.screenshot({ fullPage: true });

      // ৬. সাবমিট বাটন ক্লিক
      const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Save"), .btn-primary').first();
      await submitBtn.click();

      // ৭. সাবমিট হওয়ার পর রেজাল্ট আসাল পর্যন্ত ৫ সেকেন্ড ওয়েট
      await page.waitForTimeout(5000);

      // ৮. চূড়ান্ত কনফার্মেশন স্ক্রিনশট
      const finalScreenshot = await page.screenshot({ fullPage: true });

      await sendTelegramPhoto(
        finalScreenshot,
        `✅ *Serial ${serialNum} Processed!*\n\n👤 *Name:* ${patient.name}\n📞 *Phone:* ${patient.phone}\n🏷️ *Type:* ${patient.type} | *Gender:* ${patient.gender}`
      );

    } catch (error) {
      const errScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
      if (errScreenshot) {
        await sendTelegramPhoto(errScreenshot, `❌ *Serial ${serialNum} Failed for ${patient.name}*\n\n*Error:* ${error.message}`);
      } else {
        await sendTelegramMsg(`❌ *Serial ${serialNum} Failed for ${patient.name}*\n\n*Error:* ${error.message}`);
      }
    }

    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await browser.close();
  await sendTelegramMsg(`🎉 *All Serials Processing Completed!*`);
}

runBooking();
