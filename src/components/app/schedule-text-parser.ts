export type ParsedScheduleText = {
  date?: string;
  startTime?: string;
  endTime?: string;
  address?: string;
  customerPhone?: string;
  estimatedPrice?: string;
  additionalInfo?: string;
};

function normalizePrice(value: string) {
  const manWonMatch = value.match(/(\d[\d,.\s]*)\s*만\s*원?/);

  if (manWonMatch) {
    return String(Math.round(Number(manWonMatch[1].replace(/[,\s]/g, '')) * 10000));
  }

  const wonMatch = value.match(/(\d[\d,\s]{3,})\s*원?/);
  return wonMatch ? wonMatch[1].replace(/[,\s]/g, '') : '';
}

function normalizeTimeLabel(value: string, meridiem?: string) {
  const match = value.match(/(\d{1,2})(?::|시)?\s*(\d{1,2})?/);

  if (!match) {
    return '';
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');

  if (meridiem === '오후' && hour < 12) {
    hour += 12;
  }

  if (meridiem === '오전' && hour === 12) {
    hour = 0;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseScheduleText(sourceText: string): ParsedScheduleText {
  const text = sourceText.replace(/\r/g, '\n').trim();
  const currentYear = new Date().getFullYear();
  const parsed: ParsedScheduleText = {};
  const phoneMatch = text.match(/(?:\+82[-\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/);
  const dateMatch =
    text.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/) ??
    text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일?/);
  const timeRangeMatch = text.match(/(오전|오후)?\s*(\d{1,2}(?::|시)\s*\d{0,2}\s*분?)\s*(?:~|-|부터|에서)\s*(오전|오후)?\s*(\d{1,2}(?::|시)\s*\d{0,2}\s*분?)/);
  const singleTimeMatch = text.match(/(오전|오후)?\s*(\d{1,2}(?::|시)\s*\d{0,2}\s*분?)/);
  const price = normalizePrice(text);
  const addressLine = text
    .split('\n')
    .map((line) => line.trim())
    .find((line) => /^(주소|장소)\s*[:：]/.test(line)
      || (/(?:[가-힣]+(?:시|군|구|동|읍|면)\s+){2,}/.test(line)
        || /(?:로|길)\s*\d+|아파트|빌라|오피스텔|번지/.test(line))
        && !/^(오전|오후)?\s*\d{1,2}시/.test(line));

  if (phoneMatch) {
    parsed.customerPhone = phoneMatch[0].replace(/[.\s]/g, '-').replace(/-+/g, '-');
  }

  if (dateMatch) {
    const year = dateMatch.length === 4 ? Number(dateMatch[1]) : currentYear;
    const month = dateMatch.length === 4 ? Number(dateMatch[2]) : Number(dateMatch[1]);
    const day = dateMatch.length === 4 ? Number(dateMatch[3]) : Number(dateMatch[2]);
    parsed.date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  if (timeRangeMatch) {
    parsed.startTime = normalizeTimeLabel(timeRangeMatch[2], timeRangeMatch[1]);
    parsed.endTime = normalizeTimeLabel(timeRangeMatch[4], timeRangeMatch[3] ?? timeRangeMatch[1]);
  } else if (singleTimeMatch) {
    parsed.startTime = normalizeTimeLabel(singleTimeMatch[2], singleTimeMatch[1]);
  }

  if (price) {
    parsed.estimatedPrice = price;
  }

  if (addressLine) {
    parsed.address = addressLine.replace(/^(주소|장소)\s*[:：]\s*/, '');
  }

  parsed.additionalInfo = text;
  return parsed;
}
