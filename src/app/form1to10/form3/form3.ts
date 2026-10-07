import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-form3',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form3.html',
  styleUrls: ['./form3.css']
})
export class Form3 implements OnInit {

  district_name = '';
  zone_name = '';

  form1_id!: number;
  form2_id!: number;

  isEditMode = false;
  form3Id: number | null = null;

  // F3 society list (IMPORTANT: object list)
  f3SocietyList: {
    society_id: number;
    society_name: string;
    voter_list_prepared_count: number | null;
  }[] = [];

  // Societies that did NOT give a member list — officer prepared the
  // draft voter list himself for these (read-only, informational).
  f3NonMemberSocietyList: {
    society_id: number;
    society_name: string;
    voter_list_prepared_count: number | null;
  }[] = [];

  // society_id -> voter_list_prepared_count, from Form2 (covers both groups)
  private voterListCountMap = new Map<number, number | null>();

  // F5 & F6 need to cover BOTH member-list and non-member-list societies —
  // this is the union of f3SocietyList + f3NonMemberSocietyList.
  allSocietiesList: {
    society_id: number;
    society_name: string;
    voter_list_prepared_count: number | null;
  }[] = [];

  // F5 — keyed by society_id so it stays correct across the merged list
  // (index-based arrays broke once societies could come from two sources)
  f5AnswersMap: Record<number, 'YES' | 'NO'> = {};

  // F6
  removedCountsMap: Record<number, number> = {};
  remainingCountsMap: Record<number, number> = {};


  memberCounts: number[] = [];   // From API (readonly)

  constructor(private userService: UserService, private router: Router

  ) { }

  ngOnInit(): void {

    this.district_name = localStorage.getItem('district_name') || '';
    this.zone_name = localStorage.getItem('zone_name') || '';

    this.loadEditableForm3();
    this.loadNonMemberSocieties();
  }

  // Independent of Form3's own edit/add state — always pull the
  // non-selected group (and the counts for BOTH groups) straight
  // from Form2's editable data.
  loadNonMemberSocieties(): void {
    this.userService.getEditableForm2().subscribe({
      next: (res: any) => {
        const selected = res?.data?.selected_soc || [];
        const nonSelected = res?.data?.non_selected_soc || [];

        [...selected, ...nonSelected].forEach((s: any) => {
          this.voterListCountMap.set(s.society_id, s.voter_list_prepared_count ?? null);
        });

        this.f3NonMemberSocietyList = nonSelected.map((s: any) => ({
          society_id: s.society_id,
          society_name: s.society_name,
          voter_list_prepared_count: s.voter_list_prepared_count ?? null
        }));

        this.applyVoterListCounts();
      },
      error: () => {
        this.f3NonMemberSocietyList = [];
      }
    });
  }

  // Backfills voter_list_prepared_count onto f3SocietyList — called after
  // either f3SocietyList or voterListCountMap becomes available, whichever
  // async call (loadEditableForm3/loadF3 vs loadNonMemberSocieties) lands last.
  private applyVoterListCounts(): void {
    this.f3SocietyList = this.f3SocietyList.map(soc => ({
      ...soc,
      voter_list_prepared_count:
        this.voterListCountMap.get(soc.society_id) ?? soc.voter_list_prepared_count ?? null
    }));

    this.rebuildAllSocieties();
  }

  // Merges member + non-member societies for F5/F6, filling in defaults
  // for any society that doesn't have an answer yet — never overwrites
  // an answer already entered/loaded for one.
  private rebuildAllSocieties(): void {
    this.allSocietiesList = [...this.f3SocietyList, ...this.f3NonMemberSocietyList];

    this.allSocietiesList.forEach(soc => {
      if (!(soc.society_id in this.f5AnswersMap)) this.f5AnswersMap[soc.society_id] = 'NO';
      if (!(soc.society_id in this.removedCountsMap)) this.removedCountsMap[soc.society_id] = 0;
      if (!(soc.society_id in this.remainingCountsMap)) this.remainingCountsMap[soc.society_id] = 0;
    });
  }






  loadEditableForm3(): void {

    console.log('loadEditableForm3 called');

    this.userService.getEditableForm3().subscribe({

      next: (res: any) => {

        const d = res.data;

        this.isEditMode = true;
        this.form3Id = d.id;
        this.form2_id = d.form2_id;

        this.f3SocietyList = d.societies.map((s: any) => ({
          society_id: s.society_id,
          society_name: s.society_name,
          voter_list_prepared_count: null
        }));

        d.societies.forEach((s: any) => {
          this.f5AnswersMap[s.society_id] = (s.ero_claim === 1 || s.ero_claim === 'yes') ? 'YES' : 'NO';
          this.removedCountsMap[s.society_id] = Number(s.jcount || 0);
          this.remainingCountsMap[s.society_id] = Number(s.rcount || 0);
        });

        this.applyVoterListCounts();
      },

      error: () => {

        this.isEditMode = false;

        this.form1_id = Number(localStorage.getItem('form1_id'));

        if (this.form1_id) {
          this.loadF3();
        }
      }
    });
  }

  // ================= LOAD F3 DATA =================
  loadF3() {
    this.userService.getForm3Form2List(this.form1_id).subscribe(res => {

      console.log('API Response:', res);

      if (!res?.success) return;

      const societies: any[] = [];

      // API structure: res.data.data
      const form2List = res.data?.data || [];

      form2List.forEach((f2: any) => {

        // API uses "id", not "form2_id"
        if (!this.form2_id && f2.id) {
          this.form2_id = f2.id;
        }

        (f2.selected_soc || []).forEach((soc: any) => {

          societies.push({
            society_id: soc.society_id,
            society_name: soc.society_name,
            voter_list_prepared_count: soc.voter_list_prepared_count ?? null
          });

        });

      });

      this.f3SocietyList = societies;
      this.applyVoterListCounts();

      // console.log('Societies:', this.f3SocietyList);
      // console.log('Form2 ID:', this.form2_id);

    });
  }
  // F7's final voter count for one society: when a claim/objection was
  // raised (F5 = ஆம்), the draft count is adjusted by what F6 recorded —
  // voter_list_prepared_count - removed + added. Otherwise it's unchanged.
  finalVoterCount(soc: { society_id: number; voter_list_prepared_count: number | null }): number | string {

    if (soc.voter_list_prepared_count === null || soc.voter_list_prepared_count === undefined) {
      return '✘';
    }

    if (this.f5AnswersMap[soc.society_id] === 'YES') {
      const removed = Number(this.removedCountsMap[soc.society_id] || 0);
      const added = Number(this.remainingCountsMap[soc.society_id] || 0);
      return soc.voter_list_prepared_count - removed + added;
    }

    return soc.voter_list_prepared_count;
  }

  // ================= SUBMIT =================
  onSubmit() {

    // ass_memlist stays the original draft count; total follows F7's
    // (possibly claim-adjusted) final count.
    const society_entries = this.allSocietiesList.map((soc) => {
      const draftCount = soc.voter_list_prepared_count ?? 0;
      const finalCount = this.finalVoterCount(soc);
      const total = typeof finalCount === 'number' ? finalCount : draftCount;

      return {
        society_id: soc.society_id,
        society_name: soc.society_name,
        ass_memlist: String(draftCount),
        ero_claim: (this.f5AnswersMap[soc.society_id] || 'NO').toLowerCase(), // "yes" or "no"
        jcount: Number(this.removedCountsMap[soc.society_id] || 0),
        rcount: Number(this.remainingCountsMap[soc.society_id] || 0),
        total
      };
    });

    const payload = {
      form2_id: this.form2_id,
      remarks: `Form3 submission for Form2 ID ${this.form2_id}`,
      society_entries
    };

    /* ===== EDIT MODE ===== */
    if (this.isEditMode) {

      this.userService.editForm3(payload).subscribe((res: any) => {

        if (res.success) {

          localStorage.setItem('form3_completed', 'true');

          alert('✔ Form3 Updated Successfully');
          this.router.navigate(['/layout/totalforms']);
        }
      });

    }

    /* ===== ADD MODE ===== */
    else {

      this.userService.submitForm3(payload).subscribe((res: any) => {

        if (res.success) {

          localStorage.setItem('form3_id', res.data.id);
          localStorage.setItem('form3_completed', 'true');

          alert('✔ Form3 Submitted Successfully');
          this.router.navigate(['/layout/totalforms']);
        }
      });
    }
  }


  onCancel() {
    window.history.back();
  }
}