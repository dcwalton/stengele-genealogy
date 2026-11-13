import { AfterViewInit, Component, ElementRef, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AncestorChart,
  ChartHandle,
  ChartInfo,
  ChartType,
  DetailedRenderer,
  FamDetails,
  JsonDataProvider,
  IndiDetails,
  JsonEvent,
  JsonGedcomData,
  JsonIndi,
  createChart,
  formatDateOrRange,
  gedcomToJson,
  getChartInfo,
} from 'topola';
import { SAMPLE_GEDCOM } from './sample-gedcom';
import { jsonToGedcom } from './gedcom-export';

const SVG_ID = 'genealogy-ancestor-chart';

/** Individual records may carry a custom `military` list (e.g. ['Civil War']). */
type IndiWithMilitary = JsonIndi & { military?: string[] };

/** Canonical military-service labels, lowercase for matching. */
const MILITARY_LABELS = ['Revolutionary War', 'Civil War', 'World War I', 'World War II'];

// Topola only draws a family (marriage) box when the renderer reports
// details for it. Returning none hides all marriage date/place boxes
// while keeping the underlying data intact.
(DetailedRenderer.prototype as unknown as { getFamDetails: () => unknown[] }).getFamDetails = () => [];

// Topola draws the first and last name on two separate lines. Combine them
// into the first-name slot and blank the second line so the name sits on
// one line under the top of the box.
const baseGetIndi = JsonDataProvider.prototype.getIndi;
JsonDataProvider.prototype.getIndi = function (this: JsonDataProvider, id: string) {
  const indi = baseGetIndi.call(this, id);
  if (!indi) {
    return indi;
  }
  return new Proxy(indi, {
    get(target, prop) {
      if (prop === 'getFirstName') {
        return () =>
          [target.getFirstName(), target.getLastName()].filter(Boolean).join(' ') || null;
      }
      if (prop === 'getLastName') {
        return () => null;
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
};

/**
 * Topola's horizontal AncestorChart places the starting person on the right
 * and ancestors extending to the left. This subclass mirrors the layout
 * horizontally so the starting person is on the left and ancestors extend
 * backward in time to the right.
 */
class LeftToRightAncestorChart extends AncestorChart<IndiDetails, FamDetails> {
  override render(): ChartInfo {
    const root = this.createHierarchy();
    const nodes = this.util.layOutChart(root, { flipVertically: true });

    // Mirror all x coordinates around the horizontal center of the chart.
    const minX = Math.min(...nodes.map((n) => n.x - n.data.width / 2));
    const maxX = Math.max(...nodes.map((n) => n.x + n.data.width / 2));
    const mirror = minX + maxX;
    nodes.forEach((n) => {
      n.x = mirror - n.x;
    });

    const animationPromise = this.util.renderChart(nodes);
    const info = getChartInfo(nodes);
    this.util.updateSvgDimensions(info);
    return { ...info, animationPromise };
  }
}

/**
 * DetailedRenderer with roomier boxes so the enlarged fonts fit comfortably.
 */
class RoomyRenderer extends DetailedRenderer {
  override getPreferredIndiSize(id: string): [number, number] {
    const [width, height] = super.getPreferredIndiSize(id);
    return [Math.ceil(width * 1.25), Math.ceil(height * 1.2)];
  }
}

// Custom person-box layout: "birthdate - deathdate" under the name, then
// "born:"/"died:"/"buried:" lines for the places. Lines longer than
// MAX_DETAIL_CHARS are wrapped at word boundaries onto extra lines.
const MAX_DETAIL_CHARS = 30;

function wrapDetailText(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && `${current} ${word}`.length > MAX_DETAIL_CHARS) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.length ? lines : [text];
}

type IndiDetailLine = { symbol: string; text: string };
(RoomyRenderer.prototype as unknown as {
  getIndiDetails: (indi: IndiDetails) => IndiDetailLine[];
}).getIndiDetails = function (this: DetailedRenderer, indi: IndiDetails) {
  const locale = this.options.locale;
  const birth = indi.getBirthDate();
  const death = indi.getDeathDate();
  const birthDate = birth && formatDateOrRange(birth, locale);
  const deathDate = death && formatDateOrRange(death, locale);
  const dates = [birthDate, deathDate].filter(Boolean).join(' - ');
  const lines: string[] = [];
  if (dates) {
    lines.push(dates);
  }
  const birthPlace = indi.getBirthPlace();
  if (birthPlace) {
    lines.push(`born: ${birthPlace}`);
  }
  const deathPlace = indi.getDeathPlace();
  if (deathPlace) {
    lines.push(`died: ${deathPlace}`);
  }
  const burial = indi.getEvents?.()?.find((e) => e.type?.toUpperCase() === 'BURI');
  const burialPlace = burial?.place?.trim();
  if (burialPlace) {
    lines.push(`buried: ${burialPlace}`);
  }
  return lines.flatMap((line) => wrapDetailText(line)).map((text) => ({ symbol: '', text }));
};

/** Builds a JsonEvent from free-text date and place, or undefined if both empty. */
function buildEvent(dateText: string, place: string, type: string): JsonEvent | undefined {
  const trimmedDate = dateText.trim();
  const trimmedPlace = place.trim();
  if (!trimmedDate && !trimmedPlace) {
    return undefined;
  }
  const event: JsonEvent = { type };
  if (trimmedDate) {
    event.date = { text: trimmedDate };
  }
  if (trimmedPlace) {
    event.place = trimmedPlace;
  }
  return event;
}

/** Finds a BURI (burial) event on an individual, if present. */
function burialEvent(indi: JsonIndi): JsonEvent | undefined {
  return indi.events?.find((e) => e.type?.toUpperCase() === 'BURI');
}

/** Extracts the display text of a JsonEvent's date for editing. */
function eventDateText(event: JsonEvent | undefined): string {
  if (!event) {
    return '';
  }
  return formatDateOrRange(event).trim();
}

/** Derives a genealogy name from a file name, mirroring the server's sanitizing. */
function nameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '');
  const name = base.replace(/[\\/:*?"<>|]/g, '_').replace(/\.\./g, '_').trim();
  return name || 'imported';
}

@Component({
  selector: 'app-ancestor-chart',
  imports: [FormsModule],
  templateUrl: './ancestor-chart.html',
  styleUrl: './ancestor-chart.css',
})
export class AncestorChartComponent implements AfterViewInit {
  @ViewChild('chartHost', { static: true })
  private chartHost!: ElementRef<HTMLElement>;

  protected readonly people = signal<JsonIndi[]>([]);
  protected readonly selectedId = signal<string>('');
  protected readonly error = signal<string>('');
  protected readonly editing = signal<string | null>(null);
  protected readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
  protected readonly genealogies = signal<string[]>([]);
  protected readonly currentName = signal<string>('');

  /** Form model for the edit panel, bound with ngModel. */
  protected form: Record<string, string> = {};

  /** Military-service checkboxes in the edit panel. */
  protected military = {
    revolutionaryWar: false,
    civilWar: false,
    worldWar1: false,
    worldWar2: false,
  };

  private chartHandle?: ChartHandle;
  private json?: JsonGedcomData;
  private nextBlankId = 1;

  ngAfterViewInit(): void {
    this.init();
  }

  /** Loads the list of stored genealogies and opens the first one. */
  private async init(): Promise<void> {
    try {
      const res = await fetch('/api/genealogies');
      if (!res.ok) {
        throw new Error('List failed');
      }
      const names = (await res.json()) as string[];
      this.genealogies.set(names);
      if (names.length) {
        await this.loadFromServer(names[0]);
        return;
      }
    } catch {
      // Backend unavailable – fall through to the embedded sample.
    }
    this.loadGedcom(SAMPLE_GEDCOM);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const name = nameFromFileName(file.name);
    file.text().then((text) => {
      try {
        const json = gedcomToJson(text);
        this.registerGenealogy(name);
        this.currentName.set(name);
        this.loadJson(json);
        this.persist();
      } catch (e) {
        this.error.set(e instanceof Error ? e.message : 'Failed to parse the GEDCOM file.');
      }
    });
    input.value = '';
  }

  protected onGenealogyChange(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    this.currentName.set(name);
    this.loadFromServer(name).catch(() => {
      this.error.set('Failed to load the selected genealogy.');
    });
  }

  /** Adds a name to the dropdown list if it isn't already there. */
  private registerGenealogy(name: string): void {
    if (!this.genealogies().includes(name)) {
      this.genealogies.set([...this.genealogies(), name].sort((a, b) => a.localeCompare(b)));
    }
  }

  /** Loads a stored genealogy from the server by name. */
  private async loadFromServer(name: string): Promise<void> {
    const res = await fetch(`/api/genealogy/${encodeURIComponent(name)}`);
    if (!res.ok) {
      throw new Error('Load failed');
    }
    this.currentName.set(name);
    this.loadJson((await res.json()) as JsonGedcomData);
  }

  private loadGedcom(gedcom: string): void {
    try {
      this.loadJson(gedcomToJson(gedcom));
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to parse the GEDCOM file.');
    }
  }

  private loadJson(json: JsonGedcomData): void {
    try {
      if (!json.indis?.length) {
        throw new Error('No individuals found in the data.');
      }
      // Hide the id number and sex symbol drawn at the bottom of each box.
      for (const indi of json.indis) {
        indi.hideId = true;
        indi.hideSex = true;
      }
      // Migrate military-service note lines into the dedicated `military`
      // field (used by older saves and GEDCOM NOTE imports).
      const militaryLookup = new Map(MILITARY_LABELS.map((l) => [l.toLowerCase(), l]));
      for (const indi of json.indis) {
        const ext = indi as IndiWithMilitary;
        const notes = indi.notes ?? [];
        const kept: string[] = [];
        const found: string[] = [];
        for (const note of notes) {
          const label = militaryLookup.get(note.trim().toLowerCase());
          if (label) {
            found.push(label);
          } else {
            kept.push(note);
          }
        }
        if (found.length) {
          ext.military = [...new Set([...(ext.military ?? []), ...found])];
        }
        if (found.length || kept.length !== notes.length) {
          indi.notes = kept.length ? kept : undefined;
        }
      }
      this.json = json;
      this.error.set('');
      this.saveStatus.set('idle');
      this.editing.set(null);
      this.people.set([...json.indis].sort((a, b) => this.displayName(a).localeCompare(this.displayName(b))));
      this.selectedId.set(json.indis[0].id);
      this.ensureChart(json);
      this.renderChart(json.indis[0].id);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'Failed to load the data.');
    }
  }

  private ensureChart(json: JsonGedcomData): void {
    if (!this.chartHandle) {
      this.chartHandle = createChart({
        json,
        svgSelector: `#${SVG_ID}`,
        chartType: LeftToRightAncestorChart as unknown as ChartType,
        renderer: RoomyRenderer,
        horizontal: true,
        animate: true,
        indiCallback: (info) => this.openIndiEditor(info.id),
      });
    } else {
      this.chartHandle.setData(json);
    }
  }

  private renderChart(startIndi: string): void {
    if (!this.chartHandle) {
      return;
    }
    // Clear previous rendering so nodes are re-created.
    const svg = this.chartHost.nativeElement.querySelector('svg');
    svg?.replaceChildren();
    this.chartHandle.render({ startIndi });
    // Color just the "born:"/"died:"/"buried:" labels (not the data after
    // the colon) to match the buttons, via tspans inside the detail text.
    const SVG_NS = 'http://www.w3.org/2000/svg';
    svg?.querySelectorAll('text.details').forEach((el) => {
      const text = el.textContent ?? '';
      const match = /^(born|died|buried):/.exec(text);
      if (!match) {
        return;
      }
      const label = text.slice(0, match[0].length);
      const rest = text.slice(match[0].length);
      el.textContent = '';
      const labelSpan = document.createElementNS(SVG_NS, 'tspan');
      labelSpan.textContent = label;
      labelSpan.style.fill = '#3f51b5';
      const restSpan = document.createElementNS(SVG_NS, 'tspan');
      restSpan.textContent = rest;
      el.append(labelSpan, restSpan);
    });
    this.renderMilitaryBadges(svg);
  }

  /**
   * Draws a gold star badge (lettered C/I/II) at the top-right corner of each
   * person box whose record lists military service.
   */
  private renderMilitaryBadges(svg: SVGSVGElement | null): void {
    if (!svg || !this.json) {
      return;
    }
    const letters: Record<string, string> = {
      'revolutionary war': 'R',
      'civil war': 'C',
      'world war i': 'I',
      'world war ii': 'II',
    };
    const NS = 'http://www.w3.org/2000/svg';
    svg.querySelectorAll('g.indi').forEach((g) => {
      const data = (g as unknown as { __data__?: { indi?: { id: string; width: number } } }).__data__;
      const id = data?.indi?.id;
      const indi = id ? (this.json!.indis.find((i) => i.id === id) as IndiWithMilitary | undefined) : undefined;
      const badges = (indi?.military ?? [])
        .map((m) => letters[m.trim().toLowerCase()])
        .filter((l): l is string => !!l);
      const width = data?.indi?.width ?? 0;
      if (!badges.length || !width) {
        return;
      }
      const badgeGroup = document.createElementNS(NS, 'g');
      badgeGroup.setAttribute('class', 'military-badge');
      badges.forEach((letter, index) => {
        const cx = width - 18 - index * 27;
        const cy = 17;
        const outer = 12;
        const inner = outer * 0.42;
        const points: string[] = [];
        for (let i = 0; i < 10; i++) {
          const angle = -Math.PI / 2 + (i * Math.PI) / 5;
          const radius = i % 2 === 0 ? outer : inner;
          points.push(`${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`);
        }
        const star = document.createElementNS(NS, 'polygon');
        star.setAttribute('points', points.join(' '));
        star.setAttribute('fill', '#ffd54f');
        star.setAttribute('stroke', '#a07000');
        star.setAttribute('stroke-width', '1');
        badgeGroup.appendChild(star);
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', String(cx));
        text.setAttribute('y', String(cy + 0.5));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', letter === 'II' ? '9' : '10');
        text.setAttribute('font-weight', '700');
        text.setAttribute('fill', '#4e342e');
        text.textContent = letter;
        badgeGroup.appendChild(text);
      });
      g.appendChild(badgeGroup);
    });
  }

  /** The individual currently open in the edit panel, if any. */
  protected editingIndi(): JsonIndi | undefined {
    const id = this.editing();
    return id ? this.json?.indis.find((i) => i.id === id) : undefined;
  }

  /**
   * Which parent slot is missing from the edited person's family, if any.
   * Returns null when both parents are present (or the person has no family).
   */
  protected missingParentSlot(): 'husb' | 'wife' | 'both' | null {
    const indi = this.editingIndi();
    if (!indi?.famc || !this.json) {
      return null;
    }
    const fam = this.json.fams.find((f) => f.id === indi.famc);
    if (!fam) {
      return 'both';
    }
    if (!fam.husb && !fam.wife) {
      return 'both';
    }
    if (!fam.husb) {
      return 'husb';
    }
    if (!fam.wife) {
      return 'wife';
    }
    return null;
  }

  /**
   * Adds blank individuals as the missing parents of the person being edited,
   * so new ancestors can be entered manually. Fills whichever slots are empty
   * in the person's existing family, or creates a new family if they have none.
   */
  protected addParents(): void {
    const indi = this.editingIndi();
    if (!indi || !this.json) {
      return;
    }
    let fam = indi.famc
      ? this.json.fams.find((f) => f.id === indi.famc)
      : undefined;
    if (indi.famc && !fam) {
      return;
    }
    const needHusb = !fam?.husb;
    const needWife = !fam?.wife;
    if (!needHusb && !needWife) {
      return;
    }
    const n = this.nextBlankId++;
    if (!fam) {
      fam = { id: `N${n}P`, children: [indi.id] };
      this.json.fams.push(fam);
      indi.famc = fam.id;
    }
    fam.children = fam.children ?? [];
    if (!fam.children.includes(indi.id)) {
      fam.children.push(indi.id);
    }
    if (needHusb) {
      const id = `N${n}H`;
      this.json.indis.push({ id, hideId: true, hideSex: true });
      fam.husb = id;
    }
    if (needWife) {
      const id = `N${n}W`;
      this.json.indis.push({ id, hideId: true, hideSex: true });
      fam.wife = id;
    }
    this.refreshChart();
  }

  /**
   * Adds a single blank individual into the one missing parent slot
   * (husband or wife) of the edited person's family.
   */
  protected addParent(): void {
    const slot = this.missingParentSlot();
    const indi = this.editingIndi();
    if (!indi || !this.json || (slot !== 'husb' && slot !== 'wife')) {
      return;
    }
    const n = this.nextBlankId++;
    const id = `N${n}${slot === 'husb' ? 'H' : 'W'}`;
    this.json.indis.push({ id, hideId: true, hideSex: true });
    const fam = this.json.fams.find((f) => f.id === indi.famc);
    if (fam) {
      fam[slot] = id;
    }
    this.refreshChart();
  }

  /**
   * Whether the edited person is a leaf: no family record, or a family
   * record with neither a husband nor a wife (e.g. both parents deleted).
   */
  protected isLeafPerson(): boolean {
    const indi = this.editingIndi();
    if (!indi) {
      return false;
    }
    if (!indi.famc) {
      return true;
    }
    const fam = this.json?.fams.find((f) => f.id === indi.famc);
    return !fam || (!fam.husb && !fam.wife);
  }

  /**
   * Removes a leaf person (one with no parents) from the genealogy, cleaning
   * up any family records that reference them.
   */
  protected deletePerson(): void {
    const indi = this.editingIndi();
    if (!indi || !this.json || !this.isLeafPerson()) {
      return;
    }
    const id = indi.id;
    this.json.indis = this.json.indis.filter((i) => i.id !== id);
    const fams: JsonGedcomData['fams'] = [];
    for (const fam of this.json.fams) {
      const children = (fam.children ?? []).filter((c) => c !== id);
      const husb = fam.husb === id ? undefined : fam.husb;
      const wife = fam.wife === id ? undefined : fam.wife;
      if (husb || wife || children.length) {
        fams.push({ ...fam, husb, wife, children });
      }
    }
    this.json.fams = fams;
    if (this.selectedId() === id) {
      this.selectedId.set(this.json.indis[0]?.id ?? '');
    }
    this.editing.set(null);
    this.refreshChart();
  }

  private openIndiEditor(id: string): void {
    const indi = this.json?.indis.find((i) => i.id === id);
    if (!indi) {
      return;
    }
    this.form = {
      firstName: indi.firstName ?? '',
      lastName: indi.lastName ?? '',

      birthDate: eventDateText(indi.birth),
      birthPlace: indi.birth?.place ?? '',
      deathDate: eventDateText(indi.death),
      deathPlace: indi.death?.place ?? '',
      burial: burialEvent(indi)?.place ?? '',
      notes: (indi.notes ?? []).join('\n'),
    };
    const service = new Set(((indi as IndiWithMilitary).military ?? []).map((m) => m.toLowerCase()));
    this.military.revolutionaryWar = service.has('revolutionary war');
    this.military.civilWar = service.has('civil war');
    this.military.worldWar1 = service.has('world war i');
    this.military.worldWar2 = service.has('world war ii');
    this.editing.set(id);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
  }

  protected saveEdit(): void {
    const id = this.editing();
    if (!id || !this.json) {
      return;
    }
    this.applyIndiEdit(id);
    this.editing.set(null);
    this.refreshChart();
  }

  private applyIndiEdit(id: string): void {
    const indi = this.json!.indis.find((i) => i.id === id);
    if (!indi) {
      return;
    }
    indi.firstName = this.form['firstName']?.trim() || undefined;
    indi.lastName = this.form['lastName']?.trim() || undefined;

    indi.birth = buildEvent(this.form['birthDate'] ?? '', this.form['birthPlace'] ?? '', 'BIRT');
    indi.death = buildEvent(this.form['deathDate'] ?? '', this.form['deathPlace'] ?? '', 'DEAT');
    const burialPlace = this.form['burial']?.trim() ?? '';
    indi.events = (indi.events ?? []).filter((e) => e.type?.toUpperCase() !== 'BURI');
    if (burialPlace) {
      indi.events.push({ type: 'BURI', place: burialPlace });
    } else if (!indi.events.length) {
      indi.events = undefined;
    }
    const notes = (this.form['notes'] ?? '')
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    indi.notes = notes.length ? notes : undefined;
    const service = [
      this.military.revolutionaryWar ? 'Revolutionary War' : null,
      this.military.civilWar ? 'Civil War' : null,
      this.military.worldWar1 ? 'World War I' : null,
      this.military.worldWar2 ? 'World War II' : null,
    ].filter((n): n is string => n !== null);
    (indi as IndiWithMilitary).military = service.length ? service : undefined;
  }

  private refreshChart(): void {
    if (!this.chartHandle || !this.json) {
      return;
    }
    this.chartHandle.setData(this.json);
    this.renderChart(this.selectedId());
    // Keep the dropdown labels in sync with edited names.
    this.people.set([...this.json.indis].sort((a, b) => this.displayName(a).localeCompare(this.displayName(b))));
    this.persist();
  }

  /** Saves the current genealogy to the server under its name. */
  private persist(): void {
    const name = this.currentName();
    if (!this.json) {
      return;
    }
    if (!name) {
      this.saveStatus.set('error');
      return;
    }
    this.saveStatus.set('saving');
    fetch(`/api/genealogy/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.json),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
        if (!res.ok || !data?.ok) {
          throw new Error('Save failed');
        }
        this.saveStatus.set('saved');
      })
      .catch(() => this.saveStatus.set('error'));
  }

  /** Downloads the current genealogy as a GEDCOM file. */
  protected exportGedcom(): void {
    if (!this.json) {
      return;
    }
    const blob = new Blob([jsonToGedcom(this.json)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.currentName() || 'genealogy'}.ged`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Deletes the current genealogy from the server after confirmation. */
  protected deleteGenealogy(): void {
    const name = this.currentName();
    if (!name) {
      return;
    }
    if (!window.confirm(`Delete the genealogy "${name}"? This cannot be undone.`)) {
      return;
    }
    fetch(`/api/genealogy/${encodeURIComponent(name)}`, { method: 'DELETE' })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Delete failed');
        }
        const remaining = this.genealogies().filter((n) => n !== name);
        this.genealogies.set(remaining);
        this.currentName.set('');
        if (remaining.length) {
          return this.loadFromServer(remaining[0]);
        }
        this.loadGedcom(SAMPLE_GEDCOM);
      })
      .catch(() => this.error.set('Failed to delete the genealogy.'));
  }

  protected displayName(indi: JsonIndi): string {
    const name = [indi.firstName, indi.lastName].filter(Boolean).join(' ').trim();
    return name || indi.id;
  }
}
