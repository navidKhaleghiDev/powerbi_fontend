import DateObject from 'react-date-object';
import gregorian from 'react-date-object/calendars/gregorian';
import persian from 'react-date-object/calendars/persian';
import gregorianEn from 'react-date-object/locales/gregorian_en';
import persianEn from 'react-date-object/locales/persian_en';
import persianFa from 'react-date-object/locales/persian_fa';

export const toSolarDate = (date: string) =>
  new DateObject({ date, format: 'YYYY-MM-DD', calendar: gregorian, locale: gregorianEn }).convert(
    persian,
    persianEn,
  );

export const solarKey = (date: string, grain: 'day' | 'month' | 'year') =>
  toSolarDate(date).format(grain === 'day' ? 'YYYY-MM-DD' : grain === 'year' ? 'YYYY' : 'YYYY-MM');

export const formatSolarPeriod = (key: string, grain: string, locale: string) => {
  const date = new DateObject({
    date: grain === 'year' ? `${key}-01-01` : grain === 'month' ? `${key}-01` : key,
    format: 'YYYY-MM-DD',
    calendar: persian,
    locale: persianEn,
  });
  date.setLocale(locale === 'fa' ? persianFa : persianEn);
  return date.format(grain === 'month' ? 'MMMM YYYY' : grain === 'year' ? 'YYYY' : 'DD MMMM YYYY');
};

export const demoSolarMonths = () => {
  const months = new Set<string>();
  for (
    const date = new Date('2026-01-01T00:00:00Z');
    date.toISOString().slice(0, 10) <= '2026-06-30';
    date.setUTCDate(date.getUTCDate() + 1)
  )
    months.add(solarKey(date.toISOString().slice(0, 10), 'month'));
  return [...months];
};
