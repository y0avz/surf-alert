export const config = {
  schedule: "0 5 * * 4,5,6", // 5:00 UTC = 7:00 Israel time, Thursday(4), Friday(5), Saturday(6)
};

const PALMACHIM_LAT = 31.93;
const PALMACHIM_LNG = 34.69;

const MIN_WAVE_HEIGHT = 1.5; // meters
const MAX_WIND_SPEED = 25;   // kph

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function getWaveForecast() {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${PALMACHIM_LAT}&longitude=${PALMACHIM_LNG}&hourly=wave_height,wave_period,wind_wave_height&wind_speed_unit=kmh&forecast_days=2`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

async function getWindForecast() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${PALMACHIM_LAT}&longitude=${PALMACHIM_LNG}&hourly=windspeed_10m&wind_speed_unit=kmh&forecast_days=2`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
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

export default async function handler() {
  try {
    const [waveData, windData] = await Promise.all([
      getWaveForecast(),
      getWindForecast(),
    ]);

    const times = waveData.hourly.time;
    const waveHeights = waveData.hourly.wave_height;
    const windSpeeds = windData.hourly.windspeed_10m;

    // Check surf window: 6am to 12pm (hours 6-12) for today
    const goodSlots = [];

    for (let i = 0; i < times.length; i++) {
      const date = new Date(times[i]);
      const hour = date.getUTCHours() + 2; // Convert to Israel time (UTC+2, adjust for DST if needed)
      const normalizedHour = hour >= 24 ? hour - 24 : hour;

      // Only check morning surf window (6am - 1pm Israel time)
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

    if (goodSlots.length > 0) {
      const best = goodSlots.reduce((a, b) =>
        parseFloat(a.wave) > parseFloat(b.wave) ? a : b
      );

      const slotLines = goodSlots
        .map((s) => `  • ${s.time} — 🌊 ${s.wave}m | 💨 ${s.wind} kph`)
        .join("\n");

      const emoji = getSurfEmoji(parseFloat(best.wave));

      const message =
        `${emoji} <b>Surf Alert — Palmachim</b>\n` +
        `📅 ${dayName}, ${dateStr}\n\n` +
        `Conditions look good this morning!\n\n` +
        `<b>Good windows:</b>\n${slotLines}\n\n` +
        `Best: 🌊 ${best.wave}m waves, 💨 ${best.wind} kph wind\n\n` +
        `Go get it! 🏄`;

      await sendTelegram(message);
      console.log("Surf alert sent!");
    } else {
      console.log("No good surf today, no message sent.");
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Error:", err);
    return new Response("Error", { status: 500 });
  }
}
