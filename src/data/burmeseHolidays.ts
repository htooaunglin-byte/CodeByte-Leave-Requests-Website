export interface BurmeseHoliday {
  nameEn: string;
  nameMm: string;
  category: "national" | "cultural" | "religious";
  isMajor?: boolean;
}

// Fixed recurring holidays (MM-DD)
export const FIXED_BURMESE_HOLIDAYS: Record<string, BurmeseHoliday> = {
  "01-04": { nameEn: "Independence Day", nameMm: "လွတ်လပ်ရေးနေ့", category: "national", isMajor: true },
  "02-12": { nameEn: "Union Day", nameMm: "ပြည်ထောင်စုနေ့", category: "national", isMajor: true },
  "03-02": { nameEn: "Peasants' Day", nameMm: "တောင်သူလယ်သမားနေ့", category: "national" },
  "03-27": { nameEn: "Armed Forces Day", nameMm: "တော်လှန်ရေးနေ့ / တပ်မတော်နေ့", category: "national" },
  "04-13": { nameEn: "Thingyan Water Festival (Akyo)", nameMm: "သင်္ကြန်အကြိုနေ့", category: "cultural", isMajor: true },
  "04-14": { nameEn: "Thingyan Water Festival (Akya)", nameMm: "သင်္ကြန်အကျနေ့", category: "cultural", isMajor: true },
  "04-15": { nameEn: "Thingyan Water Festival (Akyat)", nameMm: "သင်္ကြန်အကြတ်နေ့", category: "cultural", isMajor: true },
  "04-16": { nameEn: "Thingyan Water Festival (Atat)", nameMm: "သင်္ကြန်အတက်နေ့", category: "cultural", isMajor: true },
  "04-17": { nameEn: "Myanmar New Year Day", nameMm: "နှစ်ဆန်းတစ်ရက်နေ့", category: "cultural", isMajor: true },
  "05-01": { nameEn: "World Workers' Day (Labour Day)", nameMm: "အလုပ်သမားနေ့", category: "national" },
  "07-19": { nameEn: "Martyrs' Day", nameMm: "အာဇာနည်နေ့", category: "national", isMajor: true },
  "12-25": { nameEn: "Christmas Day", nameMm: "ခရစ္စမတ်နေ့", category: "religious" },
  "12-31": { nameEn: "International New Year Holiday", nameMm: "အပြည်ပြည်ဆိုင်ရာ နှစ်သစ်ကူးရုံးပိတ်ရက်", category: "national" },
};

// Year-specific lunar/moveable holidays (YYYY-MM-DD)
export const MOVEABLE_BURMESE_HOLIDAYS: Record<string, BurmeseHoliday> = {
  // 2025
  "2025-01-29": { nameEn: "Kayin New Year Day", nameMm: "ကရင်နှစ်သစ်ကူးနေ့", category: "cultural" },
  "2025-03-13": { nameEn: "Full Moon Day of Tabaung", nameMm: "တပေါင်းလပြည့်နေ့", category: "religious" },
  "2025-05-11": { nameEn: "Full Moon Day of Kason (Buddha Day)", nameMm: "ကဆုန်လပြည့် ဗုဒ္ဓနေ့", category: "religious", isMajor: true },
  "2025-07-09": { nameEn: "Full Moon Day of Waso (Dhammacakka Day)", nameMm: "ဝါဆိုလပြည့်နေ့", category: "religious", isMajor: true },
  "2025-10-06": { nameEn: "Pre-Full Moon Day of Thadingyut", nameMm: "သီတင်းကျွတ်အကြိုနေ့", category: "religious" },
  "2025-10-07": { nameEn: "Full Moon Day of Thadingyut (Lighting Festival)", nameMm: "သီတင်းကျွတ်လပြည့်နေ့", category: "religious", isMajor: true },
  "2025-10-08": { nameEn: "Post-Full Moon Day of Thadingyut", nameMm: "သီတင်းကျွတ်အကျနေ့", category: "religious" },
  "2025-10-20": { nameEn: "Deepavali (Diwali)", nameMm: "ဒေဝါလီနေ့", category: "religious" },
  "2025-11-04": { nameEn: "Full Moon Day of Tazaungmone", nameMm: "တန်ဆောင်မုန်းလပြည့်နေ့", category: "religious", isMajor: true },
  "2025-11-05": { nameEn: "Tazaungdaing Holiday", nameMm: "တန်ဆောင်တိုင်ရုံးပိတ်ရက်", category: "cultural" },
  "2025-11-14": { nameEn: "National Day", nameMm: "အမျိုးသားနေ့", category: "national" },
  "2025-12-19": { nameEn: "Kayin New Year Day", nameMm: "ကရင်နှစ်သစ်ကူးနေ့", category: "cultural" },

  // 2026
  "2026-01-18": { nameEn: "Kayin New Year Day", nameMm: "ကရင်နှစ်သစ်ကူးနေ့", category: "cultural" },
  "2026-03-03": { nameEn: "Full Moon Day of Tabaung", nameMm: "တပေါင်းလပြည့်နေ့", category: "religious" },
  "2026-04-30": { nameEn: "Full Moon Day of Kason (Buddha Day)", nameMm: "ကဆုန်လပြည့် ဗုဒ္ဓနေ့", category: "religious", isMajor: true },
  "2026-05-27": { nameEn: "Eid al-Adha", nameMm: "အီးဒ်နေ့ (ဗာကရီးဒ်နေ့)", category: "religious" },
  "2026-07-29": { nameEn: "Full Moon Day of Waso (Beginning of Buddhist Lent / Dhammacakka Day)", nameMm: "ဝါဆိုလပြည့်နေ့ (ဓမ္မစကြာအခါတော်နေ့)", category: "religious", isMajor: true },
  "2026-10-25": { nameEn: "Pre-Full Moon Day of Thadingyut", nameMm: "သီတင်းကျွတ်အကြိုနေ့", category: "religious" },
  "2026-10-26": { nameEn: "Full Moon Day of Thadingyut (Lighting Festival)", nameMm: "သီတင်းကျွတ်လပြည့်နေ့", category: "religious", isMajor: true },
  "2026-10-27": { nameEn: "Post-Full Moon Day of Thadingyut", nameMm: "သီတင်းကျွတ်အကျနေ့", category: "religious" },
  "2026-11-08": { nameEn: "Deepavali (Diwali)", nameMm: "ဒေဝါလီနေ့", category: "religious" },
  "2026-11-23": { nameEn: "Full Moon Day of Tazaungmone", nameMm: "တန်ဆောင်မုန်းလပြည့်နေ့", category: "religious", isMajor: true },
  "2026-11-24": { nameEn: "Tazaungdaing Holiday", nameMm: "တန်ဆောင်တိုင်ရုံးပိတ်ရက်", category: "cultural" },
  "2026-12-03": { nameEn: "National Day", nameMm: "အမျိုးသားနေ့", category: "national" },

  // 2027
  "2027-01-07": { nameEn: "Kayin New Year Day", nameMm: "ကရင်နှစ်သစ်ကူးနေ့", category: "cultural" },
  "2027-03-22": { nameEn: "Full Moon Day of Tabaung", nameMm: "တပေါင်းလပြည့်နေ့", category: "religious" },
  "2027-05-19": { nameEn: "Full Moon Day of Kason (Buddha Day)", nameMm: "ကဆုန်လပြည့် ဗုဒ္ဓနေ့", category: "religious", isMajor: true },
  "2027-07-17": { nameEn: "Full Moon Day of Waso (Dhammacakka Day)", nameMm: "ဝါဆိုလပြည့်နေ့", category: "religious", isMajor: true },
  "2027-10-14": { nameEn: "Pre-Full Moon Day of Thadingyut", nameMm: "သီတင်းကျွတ်အကြိုနေ့", category: "religious" },
  "2027-10-15": { nameEn: "Full Moon Day of Thadingyut", nameMm: "သီတင်းကျွတ်လပြည့်နေ့", category: "religious", isMajor: true },
  "2027-10-16": { nameEn: "Post-Full Moon Day of Thadingyut", nameMm: "သီတင်းကျွတ်အကျနေ့", category: "religious" },
  "2027-10-29": { nameEn: "Deepavali (Diwali)", nameMm: "ဒေဝါလီနေ့", category: "religious" },
  "2027-11-12": { nameEn: "Full Moon Day of Tazaungmone", nameMm: "တန်ဆောင်မုန်းလပြည့်နေ့", category: "religious", isMajor: true },
  "2027-11-22": { nameEn: "National Day", nameMm: "အမျိုးသားနေ့", category: "national" },
  "2027-12-28": { nameEn: "Kayin New Year Day", nameMm: "ကရင်နှစ်သစ်ကူးနေ့", category: "cultural" },
};

/**
 * Returns the Burmese holiday definition for a given YYYY-MM-DD date string, or null if none.
 */
export function getBurmeseHoliday(dateStr: string): BurmeseHoliday | null {
  if (!dateStr || dateStr.length < 10) return null;

  // Check exact YYYY-MM-DD in moveable holidays first
  if (MOVEABLE_BURMESE_HOLIDAYS[dateStr]) {
    return MOVEABLE_BURMESE_HOLIDAYS[dateStr];
  }

  // Check MM-DD in fixed holidays
  const mmDd = dateStr.slice(5, 10); // "MM-DD"
  if (FIXED_BURMESE_HOLIDAYS[mmDd]) {
    return FIXED_BURMESE_HOLIDAYS[mmDd];
  }

  return null;
}

/**
 * Returns list of all Burmese holidays in a given year and month (1-indexed month)
 */
export function getBurmeseHolidaysInMonth(year: number, month: number): { dateStr: string; holiday: BurmeseHoliday }[] {
  const result: { dateStr: string; holiday: BurmeseHoliday }[] = [];
  const monthPadded = String(month).padStart(2, "0");
  
  // Check days 1..31
  for (let d = 1; d <= 31; d++) {
    const dayPadded = String(d).padStart(2, "0");
    const dateStr = `${year}-${monthPadded}-${dayPadded}`;
    const h = getBurmeseHoliday(dateStr);
    if (h) {
      result.push({ dateStr, holiday: h });
    }
  }

  return result;
}

/**
 * Checks if a range of dates [startDate, endDate] overlaps with any Burmese public holiday
 */
export function getBurmeseHolidaysInRange(startDateStr: string, endDateStr: string): { dateStr: string; holiday: BurmeseHoliday }[] {
  const holidays: { dateStr: string; holiday: BurmeseHoliday }[] = [];
  if (!startDateStr || !endDateStr) return holidays;

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) return holidays;

  const current = new Date(start);
  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const h = getBurmeseHoliday(dateStr);
    if (h) {
      holidays.push({ dateStr, holiday: h });
    }
    current.setDate(current.getDate() + 1);
  }

  return holidays;
}
