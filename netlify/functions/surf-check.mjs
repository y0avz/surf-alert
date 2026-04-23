export const config = {
  schedule: "0 5 * * 4,5,6", // 5:00 UTC = 7:00 Israel time, Thursday(4), Friday(5), Saturday(6)
};

const BEACHES = [
  { name: "Palmachim", lat: 31.93, lng: 34.69 },
  { name: "Gordon Beach (Tel Aviv)", lat: 32.085, lng: 34.768 },
  { name: "Bat Yam", lat: 32.017, lng: 34.750 },
];

const MIN_WAVE_HEIGHT = 1.5; // meters
const MAX_WIND_SPEED = 25;   // kph

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function getBeachData(lat, lng) {
  const [waveRes, windRes] = await Promise.all([
    fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=wave_height,wave_period,wind_wave_height&wind_speed_unit=kmh&forecast_days=2`),
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=windspeed_10m&wind_speed_unit=kmh&forecast_days=2`),
  ]);
  const [waveData, windData] = await Promise.all([waveRes.json(), windRes.json()]);
  return { waveData, windData };
}

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: "HTML",
    }),
  });
}

function getSurfEmoji(waveHeight) {
  if (waveHeight >= 2.0) return "🔥";
  if (waveHeight >= 1.5) return "🤙";
  return "😐";
}

function getGoodSlots(waveData, windData) {
  const times = waveData.hourly.time;
  const waveHeights = waveData.hourly.wave_height;
  const windSpeeds = windData.hourly.windspeed_10m;

  const goodSlots = [];

  for (let i = 0; i < times.length; i++) {
    const date = new Date(times[i]);
    const hour = date.getUTCHours() + 2; // UTC+2 Israel time (note: UTC+3 during DST)
    const normalizedHour = hour >= 24 ? hour - 24 : hour;

    if (normalizedHour < 6 || normalizedHour > 13) continue;

    const wave = waveHeights[i];
    const wind = windSpeeds[i];

    if (wave >= MIN_WAVE_HEIGHT && wind <= MAX_WIND_SPEED) {
      goodSlots.push({
        time: `${String(normalizedHour).padStart(2, "0")}:00`,
        wave: wave.toFixed(1),
        wind: Math.round(wind),
      });
    }
  }

  return goodSlots;
}

export default async function handler() {
  try {
    const today = new Date();
    const dayName = today.toLocaleDateString("en-IL", {
      weekday: "long",
      timeZone: "Asia/Jerusalem",
    });
    const dateStr = today.toLocaleDateString("en-IL", {
      day: "numeric",
      month: "long",
      timeZone: "Asia/Jerusalem",
    });

    const beachResults = await Promise.all(
      BEACHES.map(async (beach) => {
        const { waveData, windData } = await getBeachData(beach.lat, beach.lng);
        const goodSlots = getGoodSlots(waveData, windData);
        return { beach, goodSlots };
      })
    );

    const goodBeaches = beachResults.filter((r) => r.goodSlots.length > 0);

    if (goodBeaches.length === 0) {
      console.log("No good surf today at any beach, no message sent.");
      return new Response("OK", { status: 200 });
    }

    const beachSections = goodBeaches.map(({ beach, goodSlots }) => {
      const best = goodSlots.reduce((a, b) =>
        parseFloat(a.wave) > parseFloat(b.wave) ? a : b
      );
      const emoji = getSurfEmoji(parseFloat(best.wave));
      const slotLines = goodSlots
        .map((s) => `  • ${s.time} — 🌊 ${s.wave}m | 💨 ${s.wind} kph`)
        .join("\n");

      return (
        `${emoji} <b>${beach.name}</b>\n` +
        `${slotLines}\n` +
        `Best: 🌊 ${best.wave}m, 💨 ${best.wind} kph`
      );
    });

    const message =
      `🏄 <b>Surf Alert — ${dayName}, ${dateStr}</b>\n\n` +
      beachSections.join("\n\n─────────────\n\n") +
      `\n\nGo get it! 🤙`;

    await sendTelegram(message);
    console.log(`Surf alert sent for: ${goodBeaches.map((r) => r.beach.name).join(", ")}`);

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error:", err);
    return new Response("Error", { status: 500 });
  }
}
