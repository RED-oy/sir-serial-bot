const { chromium } = require('playwright');
const axios = require('axios');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const CONFIG = {
  url: 'http://210.4.73.10:52/appointments/apps/appointment/1424/13000',
  intervalMinutes: 1,
  patients: [
    { name: "Md Rahim", phone: "01700000001", type: "New", gender: "Male" },
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
    form.append('photo', imageBuffer, { filename: 'step.png' });
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
  await sendTelegramMsg(`🤖 *Submit Tracking Started!*\n\n📍 *Link:* ${CONFIG.url}`);

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

      // ২. মোবাইল নম্বর
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

      // ৩. টাইপ ও জেন্ডার
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

      // ৪. সাবমিট বাটন চিহ্নিত করা ও রেড বর্ডার হাইলাইট করা
      const submitBtn = page.locator('button[type="submit"]:visible, input[type="submit"]:visible, button:has-text("Submit"):visible, button:has-text("Save"):visible, .btn-primary:visible').first();
      
      // বাটনের চারপাশে লাল বর্ডার তৈরি (যাতে ছবিতে বোঝা যায় কোন বাটনে ক্লিক হচ্ছে)
      await submitBtn.evaluate(el => el.style.border = '4px solid red').catch(() => {});
      
      const beforeSubmitPic = await page.screenshot({ fullPage: true });
      await sendTelegramPhoto(beforeSubmitPic, `📸 *Job ${serialJobNum}:* Red border added around Submit Button. Clicking NOW...`);

      // সাবমিট বাটন প্রেস ও ইন্টারনেটে রিকোয়েস্ট ট্র্যাকিং
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle', timeout: 10000 }).catch(() => {}),
        submitBtn.click({ force: true })
      ]);

      // পেজ রেন্ডারিংয়ের জন্য ৫ সেকেন্ড পজ
      await page.waitForTimeout(5000);

      // ৫. সাবমিট করার পরের স্ক্রিনশট ও রেসপন্স পড়া
      const afterSubmitPic = await page.screenshot({ fullPage: true });
      const pageText = await page.innerText('body');

      const isSuccess = pageText.includes("Appointment successfully created");

      if (isSuccess) {
        let extractedSerial = "Not Detected";
        const serialMatch = pageText.match(/Serial:\s*(\d+)/i);
        if (serialMatch && serialMatch[1]) extractedSerial = serialMatch[1];

        await sendTelegramPhoto(afterSubmitPic, `✅ *Job ${serialJobNum} SUCCESSFUL!*\n\n👤 *Patient:* ${patient.name}\n🎫 *Serial:* \`${extractedSerial}\``);
      } else {
        await sendTelegramPhoto(afterSubmitPic, `📸 *Job ${serialJobNum} After Click Status:* Form response captured above.`);
      }

    } catch (error) {
      const errPic = await page.screenshot({ fullPage: true }).catch(() => null);
      if (errPic) {
        await sendTelegramPhoto(errPic, `❌ *Job ${serialJobNum} Error:* ${error.message}`);
      } else {
        await sendTelegramMsg(`❌ *Job ${serialJobNum} Error:* ${error.message}`);
      }
    }

    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await browser.close();
  await sendTelegramMsg(`🎉 *Submit Test Completed!*`);
}

runBooking();
