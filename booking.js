const { chromium } = require('playwright');
const axios = require('axios');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const CONFIG = {
  url: 'http://210.4.73.10:52/appointments/apps/appointment/1424/13000',
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

const delayStep = () => new Promise(res => setTimeout(res, 1500));

async function runBooking() {
  await sendTelegramMsg(`🤖 *Auto Serial Booking Started!*\n\n📍 *Link:* ${CONFIG.url}\n👥 *Total Patients:* ${CONFIG.patients.length}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialJobNum = i + 1;

    try {
      await page.goto(CONFIG.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await delayStep();

      // ১. নাম ফিলআপ
      const nameField = page.locator('input[type="text"]:visible, input[name*="name" i]:visible').first();
      await nameField.scrollIntoViewIfNeeded();
      await nameField.fill(patient.name);
      await delayStep();

      // ২. মোবাইল ফিলআপ
      const phoneField = page.locator('input[type="tel"]:visible, input[name*="mobile" i]:visible, input[name*="phone" i]:visible').first();
      if (await phoneField.count() === 0) {
        const allInputs = page.locator('input[type="text"]:visible');
        if (await allInputs.count() >= 2) {
          await allInputs.nth(1).fill(patient.phone);
        }
      } else {
        await phoneField.fill(patient.phone);
      }
      await delayStep();

      // ৩. টাইপ ও জেন্ডার ফিলআপ
      const selects = page.locator('select:visible');
      const selectCount = await selects.count();

      if (selectCount >= 1) {
        const typeSelect = selects.nth(0);
        if (patient.type.toLowerCase() === "new") {
          await typeSelect.selectOption({ index: 1 }).catch(() => {});
        } else {
          await typeSelect.selectOption({ index: 2 }).catch(() => {});
        }
      }
      await delayStep();

      if (selectCount >= 2) {
        const genderSelect = selects.nth(1);
        if (patient.gender.toLowerCase() === "male") {
          await genderSelect.selectOption({ index: 1 }).catch(() => {});
        } else {
          await genderSelect.selectOption({ index: 2 }).catch(() => {});
        }
      }
      await delayStep();

      // ৪. সাবমিট বাটন ক্লিক
      const submitBtn = page.locator('button[type="submit"]:visible, input[type="submit"]:visible, button:has-text("Submit"):visible').first();
      await submitBtn.click();

      // ৫. রেজাল্ট পেজ লোডের অপেক্ষা
      await page.waitForTimeout(4000);

      // ৬. রেজাল্ট ভ্যালিডেশন চেক
      const pageText = await page.innerText('body');
      const screenshot = await page.screenshot({ fullPage: true });

      const isSuccess = pageText.includes("Appointment successfully created");
      const hasProblem = pageText.includes("Problems");

      if (isSuccess) {
        let extractedSerial = "Not Detected";
        let confirmationText = "";

        const serialMatch = pageText.match(/Serial:\s*(\d+)/i);
        if (serialMatch && serialMatch[1]) {
          extractedSerial = serialMatch[1];
        }

        const resultMatch = pageText.match(/Appointment successfully created[\s\S]*?(?=Hotkey|Hotline|New Apps|$)/i);
        if (resultMatch) {
          confirmationText = resultMatch[0].trim();
        }

        const captionMsg = `✅ *Job ${serialJobNum} SUCCESSFUL!*\n\n` +
          `👤 *Patient:* ${patient.name}\n` +
          `📞 *Phone:* ${patient.phone}\n` +
          `🎫 *Serial Number:* \`${extractedSerial}\`\n\n` +
          `📝 *Message:*\n_${confirmationText || "Appointment Created Successfully"}_`;

        await sendTelegramPhoto(screenshot, captionMsg);
      } else {
        const failReason = hasProblem ? "Site returned 'Problems' (No slots available or invalid data)" : "Form Submission Failed";
        
        const captionMsg = `❌ *Job ${serialJobNum} FAILED!*\n\n` +
          `👤 *Patient:* ${patient.name}\n` +
          `📞 *Phone:* ${patient.phone}\n` +
          `⚠️ *Reason:* ${failReason}`;

        await sendTelegramPhoto(screenshot, captionMsg);
      }

    } catch (error) {
      const errScreenshot = await page.screenshot({ fullPage: true }).catch(() => null);
      if (errScreenshot) {
        await sendTelegramPhoto(errScreenshot, `❌ *Job ${serialJobNum} Error for ${patient.name}*\n\n*Error:* ${error.message}`);
      } else {
        await sendTelegramMsg(`❌ *Job ${serialJobNum} Error for ${patient.name}*\n\n*Error:* ${error.message}`);
      }
    }

    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await browser.close();
  await sendTelegramMsg(`🎉 *All 5 Appointment Jobs Processed!*`);
}

runBooking();
