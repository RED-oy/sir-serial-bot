const axios = require('axios');
const qs = require('qs');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const API_URL = 'http://210.4.73.10:52/appointments/trust_apt_pub/appointment';
const PAGE_URL = 'http://210.4.73.10:52/appointments/apps/appointment/1427/13003';
const CHAMBER_ID = '1427';

// র্যান্ডম পেশেন্ট জেনারেটর ডেটাবেজ
const MALE_NAMES = ["Tanvir Ahmed", "Sajid Hasan", "Naimur Rahman", "Arif Hossain", "Rakibul Islam", "Fahim Shahriar", "Mehedi Hasan"];
const FEMALE_NAMES = ["Nusrat Jahan", "Sadia Sultana", "Farhana Akter", "Ayesha Siddiqua", "Sabrina Khan", "Mim Akter", "Tasnim Famida"];

function getRandomPhone() {
  const prefixes = ['017', '018', '019', '015', '013', '016'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
  return `${prefix}${randomDigits}`;
}

function generatePatients(totalCount) {
  const patients = [
    { name: "Rabbi", phone: "01947673671", gender: "Male", type: "New" } // ১ম সিরিয়াল নির্দিষ্ট
  ];

  for (let i = 2; i <= totalCount; i++) {
    const isMale = Math.random() > 0.5;
    const nameList = isMale ? MALE_NAMES : FEMALE_NAMES;
    const randomName = nameList[Math.floor(Math.random() * nameList.length)];
    
    patients.push({
      name: randomName,
      phone: getRandomPhone(),
      gender: isMale ? "Male" : "Female",
      type: "New"
    });
  }
  return patients;
}

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

// আজকের তারিখ পাওয়ার লজিক (YYYY-MM-DD)
function getTodayDate() {
  const today = new Date();
  return today.toISOString().split('T')[0];
}

async function runDailyAutomation() {
  const todayDate = getTodayDate();
  const patientsList = generatePatients(7); // মোট ৭টি সিরিয়াল জেনারেট করা হলো

  await sendTelegramMsg(`🚀 *Daily Auto Serial Engine Started!*\n📅 *Date:* ${todayDate}\n👥 *Total Target Serials:* 7`);

  for (let i = 0; i < patientsList.length; i++) {
    const patient = patientsList[i];
    const serialJobNum = i + 1;

    try {
      const postData = qs.stringify({
        'averageTime': '5',
        'contact2': '28, Doyagonj,Gandaria',
        'chamber_id': CHAMBER_ID,
        'appointment_date': todayDate,
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

      const resData = response.data;

      if (resData && (resData.apt_status === true || resData.status === 200) && resData.message) {
        const details = resData.message;
        
        const telegramMessage = 
          `✅ *REAL APPOINTMENT SUCCESSFUL!*\n\n` +
          `👤 *Patient Name:* ${patient.name}\n` +
          `📞 *Phone Number:* \`${patient.phone}\`\n` +
          `🎫 *Serial Number:* \`${details.serial || 'N/A'}\`\n` +
          `🚪 *Room No:* ${details.roomNo || 'N/A'}\n` +
          `⏰ *Time Slot:* ${details.Time || 'N/A'}\n` +
          `📅 *Date:* ${todayDate}\n\n` +
          `💬 *Server Confirmation SMS Text:*\n` +
          `${details.messageFormat || 'N/A'}`;

        await sendTelegramMsg(telegramMessage);
      } else {
        const errorMsg = typeof resData === 'object' ? JSON.stringify(resData) : String(resData);
        await sendTelegramMsg(
          `❌ *Job ${serialJobNum} Failed for ${patient.name}*\n\n` +
          `⚠️ *Server Response:* \`\`\`${errorMsg}\`\`\``
        );
      }

    } catch (error) {
      await sendTelegramMsg(`❌ *Job ${serialJobNum} Error:* ${error.message}`);
    }

    // প্রতিটি সিরিয়ালের মাঝে ১ মিনিটের বিরতি (৬ষ্ঠ সিরিয়াল পর্যন্ত)
    if (i < patientsList.length - 1) {
      await new Promise(res => setTimeout(res, 60000));
    }
  }

  await sendTelegramMsg(`🎉 *All 7 Serial Jobs Completed for Today!*`);
}

runDailyAutomation();
