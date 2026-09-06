const { chromium } = require('playwright');
const axios = require('axios');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const CONFIG = {
  url: 'http://210.4.73.10:52/appointments/apps/appointment/1424/13000',
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
      await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      // হিডেন ফিল্ড এড়িয়ে দৃশ্যমান ইনপুটের জন্য অপেক্ষা
      const visibleInput = page.locator('input:visible').first();
      await visibleInput.waitFor({ state: 'visible', timeout: 20000 });

      // দৃশ্যমান ইনপুট ফিল্ডে টাইপ করা
      const inputs = page.locator('input:visible');
      const inputCount = await inputs.count();

      if (inputCount >= 2) {
        await inputs.nth(0).fill(patient.name);
        await inputs.nth(1).fill(patient.phone);
      } else {
        await page.locator('input[name*="name" i]:visible, input[placeholder*="name" i]:visible').first().fill(patient.name);
        await page.locator('input[name*="mobile" i]:visible, input[placeholder*="mobile" i]:visible').first().fill(patient.phone);
      }

      // ড্রপডাউন সিলেক্ট
      const visibleSelects = page.locator('select:visible');
      const selectCount = await visibleSelects.count();
      if (selectCount >= 2) {
        await visibleSelects.nth(0).selectOption({ label: patient.type }).catch(() => {});
        await visibleSelects.nth(1).selectOption({ label: patient.gender }).catch(() => {});
      }

      await page.waitForTimeout(1000);

      // সাবমিট বাটন ক্লিক
      const submitBtn = page.locator('button[type="submit"]:visible, input[type="submit"]:visible, button:has-text("Submit"):visible, button:has-text("Save"):visible, .btn-primary:visible').first();
      await submitBtn.click();

      // রেজাল্ট আসা পর্যন্ত অপেক্ষা
      await page.waitForTimeout(5000);

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
