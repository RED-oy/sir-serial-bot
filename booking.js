const { chromium } = require('playwright');
const axios = require('axios');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const CONFIG = {
  url: 'http://210.4.73.10:52/appointments/apps/appointment/1460/13030',
  intervalMinutes: 1,
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

async function fillSmartField(page, patient) {
  // ১. নাম ইনপুট
  const nameInput = page.locator('input[name*="name" i], input[placeholder*="name" i], input[type="text"]').first();
  await nameInput.fill(patient.name);

  // ২. মোবাইল ইনপুট
  const phoneInput = page.locator('input[name*="mobile" i], input[name*="phone" i], input[placeholder*="mobile" i], input[type="tel"]').first();
  await phoneInput.fill(patient.phone);

  // ৩. টাইপ সিলেক্ট (New / Old) - ড্রপডাউন বা সিলেক্ট ফিল্ড
  try {
    const typeSelect = page.locator('select').filter({ hasText: /new|old|type/i }).first();
    if (await typeSelect.isVisible({ timeout: 2000 })) {
      await typeSelect.selectOption({ label: patient.type });
    } else {
      await page.click(`text="${patient.type}"`);
    }
  } catch (e) {
    // যদি ড্রপডাউন না পাওয়া যায় তবে টেক্সট বা রেডিও বাটনে ক্লিক করবে
    await page.locator(`label:has-text("${patient.type}"), input[value*="${patient.type}" i]`).first().click();
  }

  // ৪. জেন্ডার সিলেক্ট (Male / Female)
  try {
    const genderSelect = page.locator('select').filter({ hasText: /male|female|gender/i }).first();
    if (await genderSelect.isVisible({ timeout: 2000 })) {
      await genderSelect.selectOption({ label: patient.gender });
    } else {
      await page.click(`text="${patient.gender}"`);
    }
  } catch (e) {
    await page.locator(`label:has-text("${patient.gender}"), input[value*="${patient.gender}" i]`).first().click();
  }
}

async function runBooking() {
  await sendTelegramMsg(`🤖 *Auto Serial Booking Started!*\n\n📍 *Link:* ${CONFIG.url}\n👥 *Total Patients:* ${CONFIG.patients.length}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialNum = i + 1;

    try {
      await page.goto(CONFIG.url, { waitUntil: 'networkidle', timeout: 45000 });

      // নতুন স্মার্ট ফিলিং ফাংশন কল
      await fillSmartField(page, patient);

      // সাবমিট বাটন খুঁজে ক্লিক করা
      const submitBtn = page.locator('button[type="submit"], input[type="submit"], button:has-text("Submit"), button:has-text("Save")').first();
      await submitBtn.click();
      
      await page.waitForTimeout(4000);

      // স্ক্রিনশট ক্যাপচার
      const screenshot = await page.screenshot({ fullPage: false });
      
      await sendTelegramPhoto(
        screenshot,
        `✅ *Serial ${serialNum} Processed!*\n\n👤 *Name:* ${patient.name}\n📞 *Phone:* ${patient.phone}\n🏷️ *Type:* ${patient.type} | *Gender:* ${patient.gender}`
      );

    } catch (error) {
      // ব্যর্থ হলেও এরর এর সময় স্ক্রিনশট নিবে যেন বোঝা যায় সমস্যা কোথায়
      const errScreenshot = await page.screenshot({ fullPage: false }).catch(() => null);
      
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
