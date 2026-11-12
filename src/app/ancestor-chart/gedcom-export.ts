import { Date, DateOrRange, JsonEvent, JsonFam, JsonGedcomData, JsonIndi } from 'topola';

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

function cleanText(text: string): string {
  // GEDCOM is line-based; collapse whitespace and newlines.
  return text.replace(/\s+/g, ' ').trim();
}

function formatGedcomDate(date: Date): string {
  const parts: string[] = [];
  if (date.qualifier) {
    parts.push(date.qualifier.toUpperCase());
  }
  if (date.day !== undefined && date.month !== undefined && date.year !== undefined) {
    parts.push(`${date.day} ${MONTHS[date.month - 1]} ${date.year}`);
  } else if (date.year !== undefined) {
    parts.push(String(date.year));
  } else if (date.text) {
    parts.push(date.text);
  } else {
    const partial = [date.day, date.month !== undefined ? MONTHS[date.month - 1] : undefined, date.year]
      .filter((p) => p !== undefined)
      .join(' ');
    if (partial) {
      parts.push(partial);
    }
  }
  return parts.join(' ');
}

function formatDateOrRange(dor: DateOrRange | undefined): string {
  if (!dor) {
    return '';
  }
  if (dor.date) {
    return formatGedcomDate(dor.date);
  }
  if (dor.dateRange) {
    const from = dor.dateRange.from ? formatGedcomDate(dor.dateRange.from) : '';
    const to = dor.dateRange.to ? formatGedcomDate(dor.dateRange.to) : '';
    if (from && to) {
      return `${from} - ${to}`;
    }
    return from || to;
  }
  return '';
}


function emitEvent(
  lines: string[],
  level: number,
  tag: string,
  event: JsonEvent | undefined,
  typeTag?: string,
): void {
  if (!event) {
    return;
  }
  const hasContent = formatDateOrRange(event) || event.place || (event.notes && event.notes.length);
  if (!hasContent) {
    return;
  }
  lines.push(`${level} ${tag}`);
  if (typeTag) {
    lines.push(`${level + 1} TYPE ${cleanText(typeTag)}`);
  }
  const dateText = formatDateOrRange(event);
  if (dateText) {
    lines.push(`${level + 1} DATE ${cleanText(dateText)}`);
  }
  if (event.place) {
    lines.push(`${level + 1} PLAC ${cleanText(event.place)}`);
  }
  for (const note of event.notes ?? []) {
    lines.push(`${level + 1} NOTE ${cleanText(note)}`);
  }
}

function pointer(id: string | undefined): string {
  return id ? `@${id.replace(/^@|@$/g, '')}@` : '';
}

function emitIndi(lines: string[], indi: JsonIndi): void {
  lines.push(`0 ${pointer(indi.id)} INDI`);

  // NAME line: "Given /Surname/"
  const nameParts: string[] = [];
  if (indi.firstName) {
    nameParts.push(indi.firstName);
  }
  if (indi.lastName) {
    nameParts.push(`/${indi.lastName}/`);
  }
  const displayName = nameParts.join(' ') || indi.id;
  lines.push(`1 NAME ${cleanText(displayName)}`);
  if (indi.firstName) {
    lines.push(`2 GIVN ${cleanText(indi.firstName)}`);
  }
  if (indi.lastName) {
    lines.push(`2 SURN ${cleanText(indi.lastName)}`);
  }
  if (indi.maidenName) {
    lines.push(`1 NOTE Maiden name: ${cleanText(indi.maidenName)}`);
  }

  if (indi.sex) {
    lines.push(`1 SEX ${indi.sex}`);
  }

  emitEvent(lines, 1, 'BIRT', indi.birth);
  emitEvent(lines, 1, 'DEAT', indi.death);
  for (const event of indi.events ?? []) {
    // Custom events (e.g. BURI) are written as EVEN + TYPE so Topola's parser
    // picks them back up on import; a bare "1 BURI" would be dropped.
    emitEvent(lines, 1, 'EVEN', event, event.type ?? 'EVEN');
  }

  for (const note of indi.notes ?? []) {
    lines.push(`1 NOTE ${cleanText(note)}`);
  }
  // Military service has no standard GEDCOM field; export as NOTE lines.
  // On import they land in notes and loadJson migrates them to `military`.
  for (const service of (indi as JsonIndi & { military?: string[] }).military ?? []) {
    lines.push(`1 NOTE ${cleanText(service)}`);
  }
  for (const image of indi.images ?? []) {
    lines.push(`1 OBJE`);
    lines.push(`2 FILE ${cleanText(image.url)}`);
    if (image.title) {
      lines.push(`2 TITL ${cleanText(image.title)}`);
    }
  }

  if (indi.famc) {
    lines.push(`1 FAMC ${pointer(indi.famc)}`);
  }
  for (const fam of indi.fams ?? []) {
    lines.push(`1 FAMS ${pointer(fam)}`);
  }
}

function emitFam(lines: string[], fam: JsonFam): void {
  lines.push(`0 ${pointer(fam.id)} FAM`);
  if (fam.husb) {
    lines.push(`1 HUSB ${pointer(fam.husb)}`);
  }
  if (fam.wife) {
    lines.push(`1 WIFE ${pointer(fam.wife)}`);
  }
  for (const child of fam.children ?? []) {
    lines.push(`1 CHIL ${pointer(child)}`);
  }
  emitEvent(lines, 1, 'MARR', fam.marriage);
}

/** Serializes Topola's JsonGedcomData back into GEDCOM 5.5.1 text. */
export function jsonToGedcom(json: JsonGedcomData): string {
  const lines: string[] = [
    '0 HEAD',
    '1 SOUR Genealogy App',
    '2 NAME Genealogy App',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    '1 CHAR UTF-8',
    '0 @SUBM@ SUBM',
    '1 NAME Genealogy App',
  ];
  for (const indi of json.indis) {
    emitIndi(lines, indi);
  }
  for (const fam of json.fams) {
    emitFam(lines, fam);
  }
  lines.push('0 TRLR');
  return lines.join('\r\n') + '\r\n';
}
