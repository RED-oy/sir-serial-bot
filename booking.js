const axios = require('axios');
const qs = require('qs');
const fs = require('fs');

const BOT_TOKEN = '8993447347:AAHjIP5P5XOoTqyRyP2nV5b_sEtZC_U7qoE';
const CHAT_ID = '8932051360';

const API_URL = 'http://210.4.73.10:52/appointments/trust_apt_pub/appointment';

// কনফিগারেশন
const PAGE_URL = 'http://210.4.73.10:52/appointments/apps/appointment/1460/13030';
const CHAMBER_ID = '1460';
const AVERAGE_TIME = '6';

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
    { name: "Mohammad Ali", phone: "01947673671", gender: "Male", type: "New" }
  ];

  for (let i = 2; i <= totalCount; i++) {
    const isMale = Math.random() > 0.5;
    const nameList = isMale ? MALE_NAMES : FEMALE_NAMES;
    
    patients.push({
      name: nameList[Math.floor(Math.random() * nameList.length)],
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

function getTodayDateBD() {
  // বাংলাদেশ টাইমজোন অনুযায়ী সঠিক তারিখ বের করা (YYYY-MM-DD)
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
}

async function runDailyAutomation() {
  const todayDate = getTodayDateBD();

  // -------------------------------------------------------------
  // ১. শুক্রবার ফিল্টার (শুক্রবার এলে সরাসরি স্কিপ করবে)
  // -------------------------------------------------------------
  const options = { timeZone: 'Asia/Dhaka', weekday: 'long' };
  const currentDayName = new Date().toLocaleString('en-US', options);

  if (currentDayName.includes('Friday')) {
    console.log("আজ শুক্রবার (Off Day)। তাই অটোমেশন চালানো হচ্ছে না।");
    await sendTelegramMsg(`🕌 *Today is Friday (Off Day)!*\nNo appointments will be booked today.`);
    return;
  }

  // -------------------------------------------------------------
  // ২. রাত ১২:০৩-এ বুকিং সফল হলে সকাল ৭:০৩-এ স্কিপ করার লজিক
  // -------------------------------------------------------------
  const STATUS_FILE = '.booking_status.json';

  if (fs.existsSync(STATUS_FILE)) {
    try {
      const savedState = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      if (savedState.date === todayDate && savedState.success === true) {
        console.log(`Today's booking already completed at midnight.`);
        await sendTelegramMsg(`ℹ️ *Notice:* Today's (${todayDate}) serial booking was already completed successfully at midnight. Skipping morning run.`);
        return;
      }
    } catch (err) {
      console.log("State file read error, proceeding with normal run...");
    }
  }

  // -------------------------------------------------------------
  // ৩. মূল সিরিয়াল বুকিং প্রসেস
  // -------------------------------------------------------------
  const patientsList = generatePatients(7);
  let isAnyBookingSuccessful = false;

  await sendTelegramMsg(`🚀 *Daily Auto Serial Engine Started!*\n📍 *Chamber ID:* ${CHAMBER_ID}\n📅 *Date:* ${todayDate}\n👥 *Total Target Serials:* 7`);

  for (let i = 0; i < patientsList.length; i++) {
    const patient = patientsList[i];
    const serialJobNum = i + 1;

    try {
      const postData = qs.stringify({
        'averageTime': AVERAGE_TIME,
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
        isAnyBookingSuccessful = true; // বুকিং সফল হয়েছে চিহ্নিত করা
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
          `❌ *Job ${serialJobNum} Failed for${patient.name}*\n\n` +
          `⚠️ *Server Response:* \`\`\`${errorMsg}\`\`\``
        );
      }

    } catch (error) {
      await sendTelegramMsg(`❌ *Job ${serialJobNum} Error:* ${error.message}`);
    }

    if (i < patientsList.length - 1) {
      await new Promise(res => setTimeout(res, 60000));
    }
  }

  // যদি অন্তত একটি বুকিং সফল হয়ে থাকে, তবে ফাইল সেভ করা হবে
  if (isAnyBookingSuccessful) {
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ date: todayDate, success: true }));
  }

  await sendTelegramMsg(`🎉 *All 7 Serial Jobs Completed for Today!*`);
}

runDailyAutomation();
