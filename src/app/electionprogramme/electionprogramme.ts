import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UserService } from '../services/user';

interface PhaseRow {
  label: string;
  description: string;
  count: number | null;
}

interface OfficerRow {
  name: string;
  values: (number | null)[];
}

interface StageEntry {
  date: string | null;
  fromTime: string | null;
  toTime: string | null;
}

interface ScheduleRow {
  no: number;
  content: string;
  stages: StageEntry[];
}

// Same 15 officers appear on both Annexure-I(a) (all 5 phases) and
// Annexure-II (Phase-I broken into its 4 stages).
const OFFICER_NAMES: string[] = [
  'Registrar of Cooperative Societies, Chennai',
  'Chief Executive Officer, Khadi & Village Industries Board',
  'Chief Executive Officer, Tamil Nadu Palm Products Development Board, Chennai',
  'Director of Sugar, Chennai',
  'Director of Sericulture, Chennai',
  'Registrar of Cooperative Societies (Housing), Chennai',
  'Director of Handlooms & Textiles, Chennai',
  'Commissioner of Agriculture, Chennai',
  'Commissioner of Milk Production & Dairy Development, Chennai',
  'Principal Secretary / Special Commissioner, Integrated Child Development Services, Chennai',
  'Director of Fisheries, Chennai',
  'Industries Commissioner and Director of Industries and Commerce, Chennai',
  'Director of Animal Husbandry and Veterinary Services, Chennai',
  'Director of Social Welfare, Chennai',
  'Commissioner of Rural Development (Bhoodan Societies) Chennai'
];

const SCHEDULE_CONTENTS: string[] = [
  'Publication of Election Notice by the District Election Officer',
  'Furnishing members list by the societies to the Electoral Officer',
  'Publication of voters list by Electoral Officer',
  'Publication of voters list by Electoral officer in case the list of members are not furnished by the society and he himself prepare the voters list',
  'Filing Claims or objections to the Voters List',
  'Decision of the electoral officer on claims made or objections raised',
  'Publication of final voters list by Electoral Officer',
  'Filing of Nomination',
  'Scrutiny of Nominations',
  'Publication of list of valid Nominations',
  'Withdrawal of Nomination',
  'Publication of final list of contesting candidates',
  'Polling if required',
  'Counting and Declaration of Results',
  'Issue of notice for Election of Office Bearers',
  'Election of President/ Vice-President'
];

@Component({
  selector: 'app-electionprogramme',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './electionprogramme.html',
  styleUrls: ['./electionprogramme.css']
})
export class ElectionProgramme implements OnInit {

  // Anyone can view this page; only an admin can edit the fields.
  isAdmin = localStorage.getItem('role') === 'admin';

  // Each section (page1 / page2 / page3 / schedule) starts locked —
  // even for admin. "Edit" unlocks just that section; "Submit" saves
  // just that section's data and locks it back.
  private unlockedSections = new Set<string>();

  // id of the election_programme row on the backend. null until the
  // first successful save (or until GET finds an existing record) —
  // submitSection() creates the row on first save, then patches it.
  private recordId: number | null = null;

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.userService.getElectionProgrammes().subscribe({
      next: (res: any) => {
        // The endpoint returns res.data as EITHER a single record
        // object (the actual observed shape: {success, data:{id,
        // phases, ...}}) or a list of them — handle both rather than
        // assuming an array.
        const payload = res?.data ?? res;

        const record = Array.isArray(payload)
          ? payload
              .filter((r: any) => r.is_active !== 0)
              .sort((a: any, b: any) => (b.id ?? 0) - (a.id ?? 0))[0]
          : payload;

        if (record?.id) {
          this.recordId = record.id;
          this.applyRecord(record);
        } else {
          console.error('GET /election-programmes did not return a usable record — check the actual shape:', res);
        }
      },
      error: () => {
        // No record yet (or the endpoint isn't reachable) — page
        // just stays empty for the admin to fill in from scratch.
      }
    });
  }

  private applyRecord(record: any): void {

    if (Array.isArray(record.phases)) {
      record.phases.forEach((p: any) => {
        const row = this.phases[p.phase_no - 1];
        if (row) row.count = p.count ?? null;
      });
    }

    if (Array.isArray(record.annexure_1a)) {
      record.annexure_1a.forEach((r: any, i: number) => {
        if (this.annexure1aOfficers[i]) {
          this.annexure1aOfficers[i].values = r.values ?? [null, null, null, null, null];
        }
      });
    }

    if (Array.isArray(record.annexure_2)) {
      record.annexure_2.forEach((r: any, i: number) => {
        if (this.annexure2Officers[i]) {
          this.annexure2Officers[i].values = r.values ?? [null, null, null, null];
        }
      });
    }

    if (Array.isArray(record.schedule)) {
      record.schedule.forEach((r: any, i: number) => {
        const row = this.scheduleRows[i];
        if (row && Array.isArray(r.stages)) {
          row.stages = r.stages.map((s: any) => ({
            date: s.date ?? null,
            fromTime: s.from_time ?? null,
            toTime: s.to_time ?? null
          }));
        }
      });
    }
  }

  // Always sends ALL FOUR sections together, built from whatever is
  // currently in memory — which is either what the single shared GET
  // on page load fetched, or (for the one section actively being
  // edited) the admin's latest changes. This way every submit is a
  // complete, self-consistent record: the other three sections just
  // round-trip their already-fetched values unchanged, and it works
  // regardless of whether the backend treats a field as required.
  private buildPayload(): any {

    const userId = Number(localStorage.getItem('uid')) || undefined;

    return {
      phases: this.phases.map((p, i) => ({ phase_no: i + 1, count: p.count })),

      annexure_1a: this.annexure1aOfficers.map(o => ({ officer_name: o.name, values: o.values })),

      annexure_2: this.annexure2Officers.map(o => ({ officer_name: o.name, values: o.values })),

      schedule: this.scheduleRows.map(r => ({
        no: r.no,
        content: r.content,
        stages: r.stages.map(s => ({
          date: s.date,
          from_time: s.fromTime,
          to_time: s.toTime
        }))
      })),

      updated_by: userId,
      created_by: userId
    };
  }

  isUnlocked(section: string): boolean {
    return this.isAdmin && this.unlockedSections.has(section);
  }

  startEdit(section: string): void {
    if (!this.isAdmin) return;
    this.unlockedSections.add(section);
  }

  submitSection(section: string): void {

    if (!this.isAdmin) return;

    const payload = this.buildPayload();

    const request$ = this.recordId
      ? this.userService.updateElectionProgramme(this.recordId, payload)
      : this.userService.createElectionProgramme(payload);

    request$.subscribe({
      next: (res: any) => {
        // Same uncertainty as the list response — try every plausible
        // shape so we never fail to capture the record.
        const record =
          res?.data ??
          res?.election_programme ??
          res?.data?.election_programme ??
          res;

        if (record?.id) {
          // THIS is the id that keeps every subsequent Submit as an
          // update (PATCH) on the same row instead of accidentally
          // creating a new one — missing it is what made
          // previously-saved sections disappear after a reload.
          this.recordId = record.id;

          // Re-apply exactly what the backend now has, for ALL four
          // sections — not just what we sent. This is the "submit,
          // then fetch it back" step: whatever the backend actually
          // persisted (including any normalization it applies) is
          // what ends up on screen, not just whatever was already
          // there before the request went out.
          this.applyRecord(record);
        } else {
          console.error('Could not find a record/id in the save response — check the actual shape:', res);
        }

        this.unlockedSections.delete(section);
        alert('சமர்ப்பிக்கப்பட்டது (Submitted successfully)');
      },
      error: (err: any) => {
        alert(err?.error?.message || 'Submit failed');
      }
    });
  }

  // ==========================================
  // PAGE 1 — Annexure I: 5 Phases of Election
  // ==========================================
  phases: PhaseRow[] = [
    {
      label: 'PHASE-1',
      description: 'All Primary Cooperative Societies (Except Cooperative Marketing Societies)',
      count: null
    },
    {
      label: 'PHASE-2',
      description: 'Cooperative Marketing Societies, Cooperative Sugar Mills and Central Societies under Functional Registrars',
      count: null
    },
    {
      label: 'PHASE-3',
      description: 'Central Cooperative Banks, Cooperative Wholesale Stores, and All Apex cooperative Societies (Except TamilNadu State Apex Cooperative Bank, TamilNadu Consumer Cooperative Federation and TamilNadu Cooperative Union)',
      count: null
    },
    {
      label: 'PHASE-4',
      description: 'District Cooperative Unions, Cooperative Printing Presses, TamilNadu State Apex Cooperative Bank, TamilNadu Consumer Cooperative Federation and TamilNadu Industrial Cooperative Bank',
      count: null
    },
    {
      label: 'PHASE-5',
      description: 'TamilNadu Cooperative Union',
      count: null
    }
  ];

  // ==========================================
  // PAGE 2 — Annexure I(a): societies per phase, per officer
  // ==========================================
  annexure1aOfficers: OfficerRow[] = OFFICER_NAMES.map(name => ({
    name,
    values: [null, null, null, null, null] // In I..V Phase
  }));

  // Static index lists for the totals row — kept as real properties
  // rather than inline array literals in the template, since a fresh
  // array on every change-detection pass makes *ngFor tear down and
  // rebuild on every keystroke.
  readonly phaseColumnIndexes = [0, 1, 2, 3, 4];
  readonly stageColumnIndexes = [0, 1, 2, 3];

  // ==========================================
  // PAGE 3 — Annexure II: Phase-I societies, per stage, per officer
  // ==========================================
  annexure2Officers: OfficerRow[] = OFFICER_NAMES.map(name => ({
    name,
    values: [null, null, null, null] // In I..IV Stage
  }));

  // ==========================================
  // PAGES 4-6 — Annexure II(a): election schedule dates
  // ==========================================
  scheduleRows: ScheduleRow[] = SCHEDULE_CONTENTS.map((content, i) => ({
    no: i + 1,
    content,
    stages: [
      { date: null, fromTime: null, toTime: null },
      { date: null, fromTime: null, toTime: null },
      { date: null, fromTime: null, toTime: null },
      { date: null, fromTime: null, toTime: null }
    ]
  }));

  // ==========================================
  // COMPUTED TOTALS (derived, never manually entered)
  // ==========================================

  columnTotal(officers: OfficerRow[], columnIndex: number): number {
    return officers.reduce((sum, row) => sum + (Number(row.values[columnIndex]) || 0), 0);
  }

  rowTotal(row: OfficerRow): number {
    return row.values.reduce((sum: number, v) => sum + (Number(v) || 0), 0);
  }

  grandTotal(officers: OfficerRow[]): number {
    return officers.reduce((sum, row) => sum + this.rowTotal(row), 0);
  }
}
