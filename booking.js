const axios = require('axios');
const FormData = require('form-data');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

// আসল ব্যাকএন্ড API এন্ডপয়েন্ট
const API_URL = 'http://210.4.73.10:52/appointments/trust_apt_pub/appointment';

const CONFIG = {
  intervalMinutes: 1,
  // এখানে আপনার রোগীদের তথ্য আপডেট করুন
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

// আজকের পর দিনের (আগামীকালের) তারিখ অটোমেটিক বের করার ফাংশন (YYYY-MM-DD)
function getAppointmentDate() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

async function runDirectApiBooking() {
  await sendTelegramMsg(`🚀 *Fast API Serial Booking Started!*\n\n📍 *Endpoint:* \`${API_URL}\`\n👥 *Total Patients:* ${CONFIG.patients.length}`);

  const aptDate = getAppointmentDate(); // অটোমেটিক আগামীকালের তারিখ নিবে

  for (let i = 0; i < CONFIG.patients.length; i++) {
    const patient = CONFIG.patients[i];
    const serialJobNum = i + 1;

    try {
      // payload তৈরি
      const formData = new FormData();
      formData.append('averageTime', '5');
      formData.append('contact2', '28,+Doyagonj,Gandaria');
      formData.append('chamber_id', '1424');
      formData.append('appointment_date', aptDate);
      formData.append('pat_name', patient.name);
      formData.append('pat_contact', patient.phone);
      formData.append('sample', '');

      // Direct POST Request
      const response = await axios.post(API_URL, formData, {
        headers: {
          ...formData.getHeaders(),
          'Host': '210.4.73.10:52',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
          'X-Requested-With': 'XMLHttpRequest',
          'Origin': 'http://210.4.73.10:52',
          'Referer': 'http://210.4.73.10:52/appointments/apps/appointment/1424/13000',
          'Accept-Language': 'en-BD,en-GB;q=0.9,en-US;q=0.8,en;q=0.7'
        }
      });

      const responseText = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

      // কনফার্মেশন ও সিরিয়াল চেক
      if (responseText.includes("Appointment successfully created") || responseText.includes("Serial:")) {
        let extractedSerial = "Detected";
        const serialMatch = responseText.match(/Serial:\s*(\d+)/i);
        if (serialMatch && serialMatch[1]) {
          extractedSerial = serialMatch[1];
        }

        await sendTelegramMsg(
          `✅ *Job ${serialJobNum} SUCCESSFUL!*\n\n` +
          `👤 *Patient:* ${patient.name}\n` +
          `📞 *Phone:* ${patient.phone}\n` +
          `🎫 *Serial Number:* \`${extractedSerial}\`\n` +
          `📅 *Date:* ${aptDate}`
        );
      } else if (responseText.includes("Problems")) {
        await sendTelegramMsg(`❌ *Job ${serialJobNum} Failed:* Site returned 'Problems' (Slot Full / Booking Closed)`);
      } else {
        await sendTelegramMsg(`ℹ️ *Job ${serialJobNum} Response Received:*\n\`\`\`\n${responseText.slice(0, 300)}\n\`\`\``);
      }

    } catch (error) {
      await sendTelegramMsg(`❌ *Job ${serialJobNum} Request Error:* ${error.message}`);
    }

    // পরবর্তী রোগীর জন্য ১ মিনিটের বিরতি
    if (i < CONFIG.patients.length - 1) {
      await new Promise(res => setTimeout(res, CONFIG.intervalMinutes * 60000));
    }
  }

  await sendTelegramMsg(`🎉 *All 5 API Appointments Processed!*`);
}

runDirectApiBooking();
