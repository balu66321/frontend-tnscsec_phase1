import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user';
import { Router } from '@angular/router';

type CategoryType = 'sc_st' | 'women' | 'general';

interface Candidate {
  form5_member_id: number;
  member_name: string;
  aadhar_no: string;
  category_type: CategoryType;
  is_elected: boolean;
}

@Component({
  selector: 'app-form10',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form10.html',
  styleUrls: ['./form10.css']
})
export class Form10 implements OnInit {

  // Statuses that mean a candidate is no longer in the running.
  // Anything else (including null/undefined) is still active — the
  // preview API leaves status null until a candidate is actually
  // rejected/withdrawn/decided.
  private static readonly DECIDED_STATUSES = ['REJECTED', 'WITHDRAWN', 'LOST', 'ELECTED'];

  // ==========================================
  // TABLES (see flow: F3 -> First selection -> Rejected(view)
  //         -> F4 withdraw selection -> Withdrawn(view)
  //         -> Final list -> Results)
  // ==========================================

  // TABLE 1 — all filed members, view only
  f3List: any[] = [];

  // TABLE 2 — societies not yet screened (reject/continue decision)
  firstSelectionList: any[] = [];

  // TABLE 3 — rejected societies, view only (society-level, automatic)
  rejectedSocietiesList: any[] = [];

  // TABLE 4 — screened societies (>1 still contesting) that need a
  // withdraw/continue decision before the final vice president pick
  f4List: any[] = [];
  showF4Table = false;

  // TABLE 5 — withdrawn societies, view only (society-level, automatic)
  f4WithdrawnList: any[] = [];

  // TABLE 6 — final eligible list; single-select the Vice President here (POLL)
  f5List: any[] = [];
  showF5Table = false;

  // Societies already finalized (UNOPPOSED or POLL) this session
  finalizedSocieties = new Set<number>();

  // Guards against firing the auto-finalize API call twice for the
  // same society while its request is still in flight
  private autoFinalizing = new Set<number>();

  // TABLE 7 — final result table (Sl.No, Society, Vice President, Election type)
  finalizedResultsList: any[] = [];

  isFormSubmitted = false;

  district_name = '';
  zone_name = '';

  showModal = false;
  selectedSociety: any = null;
  candidates: Candidate[] = [];

  // VIEW ONLY MODAL
  // ======================
  showViewModal = false;
  viewSociety: any = null;
  viewCandidates: Candidate[] = [];

  // Finalize controls (TABLE 6)
  selectedVicePresidentId: number | null = null;

  // Action control
  currentAction: 'REJECT' | 'WITHDRAW' | 'FINALIZE' | null = null;

  form10_id!: number;

  constructor(private userService: UserService, private router: Router) { }

  // ======================
  // PAGE LOAD
  // ======================
  ngOnInit(): void {
    this.district_name = localStorage.getItem('district_name') || '';
    this.zone_name = localStorage.getItem('zone_name') || '';
    this.callInitOnce();
  }

  callInitOnce(): void {
    this.userService.form10init({}).subscribe({
      next: (res: any) => {
        this.form10_id = res?.data?.form10_id;
        this.loadPreview();
      },
      error: () => this.loadPreview()
    });
  }

  // ======================
  // VIEW SOCIETY - READ ONLY
  // ======================
  viewSocietyDetails(row: any): void {

    this.viewSociety = row;

    this.viewCandidates = (row.candidates || []).map((c: any) => ({
      form5_member_id: c.form5_member_id,
      member_name: c.member_name,
      aadhar_no: c.aadhar_no,
      category_type: c.category_type,
      is_elected: false
    }));

    this.showViewModal = true;
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.viewSociety = null;
    this.viewCandidates = [];
  }

  // ======================
  // PREVIEW (Main Source)
  // ======================
  loadPreview(): void {
    this.userService.getForm10Preview().subscribe({
      next: (res: any) => {

        if (!res?.success || !res.data?.societies) {
          this.f3List = [];
          this.firstSelectionList = [];
          this.rejectedSocietiesList = [];
          this.f4List = [];
          this.f4WithdrawnList = [];
          this.f5List = [];
          this.showF4Table = false;
          this.showF5Table = false;
          return;
        }

        const societies = res.data.societies || [];

        // Only societies that actually have members filed
        const validSocieties = societies.filter(
          (soc: any) =>
            Array.isArray(soc.candidates) &&
            soc.candidates.length > 0
        );

        this.district_name = res.data.district_name;
        this.zone_name = res.data.zone_name;

        // ==========================================
        // PER-STAGE CANDIDATE POOLS
        //
        // The backend precomputes each stage's candidate pool
        // directly (table1_candidates..table6_candidates) — use those
        // when present since they're authoritative, and only fall
        // back to deriving the pool ourselves for older responses
        // that don't include them yet.
        // ==========================================

        const table1 = (soc: any): any[] => soc.table1_candidates || soc.candidates || [];
        const table2 = (soc: any): any[] => soc.table2_candidates || soc.candidates || [];

        const table3 = (soc: any): any[] =>
          soc.table3_candidates ||
          soc.rejected_members?.all ||
          (soc.candidates || []).filter((c: any) => c.status === 'REJECTED');

        const table4 = (soc: any): any[] =>
          soc.table4_candidates || this.contestingCandidates(soc);

        const table5 = (soc: any): any[] =>
          soc.table5_candidates ||
          soc.withdrawn_members?.all ||
          (soc.candidates || []).filter((c: any) => c.status === 'WITHDRAWN');

        const table6 = (soc: any): any[] =>
          soc.table6_candidates || table4(soc);

        // A society has "completed" TABLE 2 once the backend's explicit
        // flag says so; fall back to inferring it from counts for older
        // responses without that flag.
        const hasCompletedFirstSelection = (soc: any): boolean => {
          if (typeof soc.is_rejected_submitted === 'boolean') {
            return soc.is_rejected_submitted;
          }
          if (table3(soc).length > 0) return true;
          if ((soc.rejected_counts?.total ?? 0) > 0) return true;
          const total = (soc.candidates || []).length;
          return this.contestingCandidates(soc).length < total;
        };

        // A society has completed TABLE 4 (withdraw) once it has any
        // withdrawn member.
        const hasCompletedWithdrawStep = (soc: any): boolean =>
          table5(soc).length > 0 || (soc.withdrawn_counts?.total ?? 0) > 0;

        // ==========================================
        // TABLE 1 — ALL FILED MEMBERS (view only)
        // ==========================================
        this.f3List = validSocieties.map((soc: any) => ({
          form10_society_id: soc.form10_society_id,
          society_name: soc.society_name,
          candidates: table1(soc)
        }));

        // ==========================================
        // TABLE 2 — FIRST SELECTION (societies not yet screened)
        // ==========================================
        this.firstSelectionList = validSocieties
          .filter((soc: any) => !hasCompletedFirstSelection(soc))
          .map((soc: any) => ({
            form10_society_id: soc.form10_society_id,
            society_name: soc.society_name,
            candidates: table2(soc)
          }));

        // ==========================================
        // TABLE 3 — REJECTED, view only, society-level
        // (All candidates - Selected candidates = Rejected)
        // ==========================================
        this.rejectedSocietiesList = validSocieties
          .filter((soc: any) => table3(soc).length > 0)
          .map((soc: any) => ({
            form10_society_id: soc.form10_society_id,
            society_name: soc.society_name,
            candidates: table3(soc)
          }));

        // ==========================================
        // TABLE 4 — WITHDRAW SELECTION
        //
        // Screened societies (TABLE 2 done) with MORE THAN ONE
        // candidate still contesting, not yet through the withdraw
        // step, and not finalized. A single surviving candidate after
        // TABLE 2 skips straight to auto-UNOPPOSED (below) and never
        // needs a TABLE 4 step.
        // ==========================================

        const afterFirstSelection = validSocieties.filter((soc: any) =>
          hasCompletedFirstSelection(soc) &&
          !this.isSocietyFinalized(soc, Number(soc.form10_society_id))
        );

        this.f4List = afterFirstSelection
          .filter((soc: any) => !hasCompletedWithdrawStep(soc))
          .map((soc: any) => ({
            form10_society_id: soc.form10_society_id,
            society_name: soc.society_name,
            total: table4(soc).length,
            candidates: table4(soc)
          }))
          .filter((row: any) => row.total > 1);

        this.showF4Table = this.f4List.length > 0;

        // ==========================================
        // AUTO-FINALIZE — exactly one candidate left, right
        // after TABLE 2 or right after TABLE 4, becomes Vice
        // President UNOPPOSED with no extra selection step.
        // ==========================================

        afterFirstSelection
          .filter((soc: any) => !hasCompletedWithdrawStep(soc) && table4(soc).length === 1)
          .forEach((soc: any) => this.autoFinalizeUnopposed(soc, table4(soc)[0]));

        afterFirstSelection
          .filter((soc: any) => hasCompletedWithdrawStep(soc) && table6(soc).length === 1)
          .forEach((soc: any) => this.autoFinalizeUnopposed(soc, table6(soc)[0]));

        // ==========================================
        // TABLE 5 — WITHDRAWN, view only, society-level
        // ==========================================

        this.f4WithdrawnList = validSocieties
          .filter((soc: any) => table5(soc).length > 0)
          .map((soc: any) => ({
            form10_society_id: soc.form10_society_id,
            society_name: soc.society_name,
            candidates: table5(soc)
          }));

        // ==========================================
        // TABLE 6 — FINAL ELIGIBLE LIST (Vice President selection, POLL)
        //
        // Societies that have gone through the withdraw step and
        // are not yet finalized. Candidates shown are whoever is
        // still contesting after withdrawal.
        // ==========================================

        this.f5List = afterFirstSelection
          .filter((soc: any) => hasCompletedWithdrawStep(soc))
          .map((soc: any) => ({
            form10_society_id: soc.form10_society_id,
            society_name: soc.society_name,
            total: table6(soc).length,
            candidates: table6(soc)
          }))
          .filter((row: any) => row.total > 1);

        this.showF5Table = this.f5List.length > 0;

        // ==========================================
        // TABLE 7 — FINALIZED RESULTS — hydrate from backend
        //
        // Societies already finalized (this session or an earlier
        // one) may carry: table7_vice_president (most direct — bundles
        // the winner + election_type together), vice_president_winner
        // (admin list API), flat vice_president_name/
        // vice_president_category, or just
        // vice_president_form5_candidate_id pointing into
        // candidates[] — try each in turn.
        // ==========================================

        validSocieties
          .filter((soc: any) => this.isSocietyFinalized(soc, Number(soc.form10_society_id)))
          .forEach((soc: any) => {

            const societyId = Number(soc.form10_society_id);

            const alreadyListed = this.finalizedResultsList.some(
              (item: any) => Number(item.form10_society_id) === societyId
            );

            if (alreadyListed) return;

            const winnerCandidate =
              (soc.candidates || []).find(
                (c: any) => Number(c.form5_member_id) === Number(soc.vice_president_form5_candidate_id)
              ) ||
              (soc.candidates || []).find((c: any) => c.status === 'ELECTED');

            const winner =
              soc.table7_vice_president ||
              soc.vice_president_winner ||
              (soc.vice_president_name
                ? { member_name: soc.vice_president_name, category_type: soc.vice_president_category }
                : null) ||
              winnerCandidate;

            this.pushFinalizedResult(
              societyId,
              soc.society_name,
              winner,
              soc.table7_vice_president?.election_type || soc.election_type || '-'
            );
          });
      }
    });
  }

  // A society counts as finalized if the backend says so directly
  // (is_finalized / vice_president_winner / table7_vice_president
  // from the admin list or preview API), if it has a
  // vice_president_form5_candidate_id set, or if we finalized it
  // locally this session.
  private isSocietyFinalized(soc: any, societyId: number): boolean {
    return (
      this.finalizedSocieties.has(societyId) ||
      soc.is_finalized === true ||
      !!soc.table7_vice_president ||
      !!soc.vice_president_winner ||
      !!soc.vice_president_form5_candidate_id
    );
  }

  private contestingCandidates(soc: any): any[] {
    return (soc.candidates || []).filter(
      (c: any) => !Form10.DECIDED_STATUSES.includes(c.status)
    );
  }

  // Directly finalizes a society as UNOPPOSED when exactly one
  // candidate remains right after TABLE 2 — no TABLE 4/6 step needed.
  private autoFinalizeUnopposed(soc: any, winner: any): void {

    const societyId = Number(soc.form10_society_id);

    if (this.finalizedSocieties.has(societyId) || this.autoFinalizing.has(societyId)) {
      return;
    }

    if (!winner) return;

    this.autoFinalizing.add(societyId);

    const payload = {
      form10_society_id: societyId,
      election_type: 'UNOPPOSED',
      vice_president_form5_candidate_id: winner.form5_member_id
    };

    this.userService.form10societyfinalize(payload).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.finalizedSocieties.add(societyId);
          this.pushFinalizedResult(societyId, soc.society_name, winner, 'UNOPPOSED');
        }
        this.autoFinalizing.delete(societyId);
      },
      error: () => this.autoFinalizing.delete(societyId)
    });
  }

  private pushFinalizedResult(
    societyId: number,
    societyName: string,
    candidate: any,
    electionType: string
  ): void {

    const resultRow = {
      form10_society_id: societyId,
      society_name: societyName,
      vice_president_name: candidate?.member_name || '-',
      election_type: electionType
    };

    const existingIndex = this.finalizedResultsList.findIndex(
      (item: any) => Number(item.form10_society_id) === societyId
    );

    if (existingIndex >= 0) {
      this.finalizedResultsList[existingIndex] = resultRow;
    } else {
      this.finalizedResultsList.push(resultRow);
    }
  }

  // ======================
  // OPEN MODAL
  // ======================
  addSociety(row: any, action: 'REJECT' | 'WITHDRAW' | 'FINALIZE'): void {
    this.selectedSociety = row;
    this.currentAction = action;

    this.selectedVicePresidentId = null;

    this.candidates = (row.candidates || []).map((c: any) => ({
      form5_member_id: c.form5_member_id,
      member_name: c.member_name,
      aadhar_no: c.aadhar_no,
      category_type: c.category_type,
      // REJECT/WITHDRAW modals: checked = continue.
      // FINALIZE modal: unused (checkbox drives selectedVicePresidentId instead).
      is_elected: false
    }));

    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedSociety = null;
    this.candidates = [];
    this.currentAction = null;
  }

  // TABLE 6 — exclusive single-select via checkbox
  selectVicePresident(candidate: Candidate): void {
    this.candidates.forEach(c => c.is_elected = false);
    candidate.is_elected = true;
    this.selectedVicePresidentId = candidate.form5_member_id;
  }

  maskAadhar(aadhar: string): string {
    return aadhar ? 'xxxx xxxx ' + aadhar.slice(-4) : '';
  }

  // ======================
  // SUBMIT (REJECT / WITHDRAW / FINALIZE)
  // ======================

  submitModal(): void {

    if (!this.selectedSociety) return;

    // ==========================
    // TABLE 6 → FINALIZE (POLL)
    // ==========================
    if (this.currentAction === 'FINALIZE') {

      if (!this.selectedVicePresidentId) {
        alert('ஒரு உறுப்பினரை தேர்வு செய்யவும்');
        return;
      }

      const payload = {
        form10_society_id: this.selectedSociety.form10_society_id,
        election_type: 'POLL',
        vice_president_form5_candidate_id: this.selectedVicePresidentId
      };

      this.userService.form10societyfinalize(payload).subscribe({
        next: (res: any) => {

          if (res?.success) {

            alert('Society Finalized');

            const societyId = Number(this.selectedSociety.form10_society_id);

            this.finalizedSocieties.add(societyId);

            const row = this.f5List.find(
              (item: any) => Number(item.form10_society_id) === societyId
            );
            if (row) row.submitted = true;

            const vicePresident = this.candidates.find(
              c => c.form5_member_id === this.selectedVicePresidentId
            );

            this.pushFinalizedResult(societyId, this.selectedSociety.society_name, vicePresident, 'POLL');

            // Close modal only — DON'T call loadPreview()
            this.closeModal();
          }
        },
        error: err => alert(err?.error?.message || 'Finalize failed')
      });

      return;
    }

    // ==========================
    // TABLE 4 → WITHDRAW
    //
    // CHECKED   = candidate continues to TABLE 6
    // UNCHECKED = candidate is withdrawn
    //
    // The backend's candidates[] payload is the KEEP list — anyone
    // NOT included gets marked WITHDRAWN automatically. So we send
    // the checked (continuing) candidates, not the unchecked ones.
    // ==========================
    if (this.currentAction === 'WITHDRAW') {

      const continuing = this.candidates.filter(c => c.is_elected);

      if (continuing.length === 0) {
        alert('குறைந்தது ஒரு உறுப்பினரையாவது தொடர தேர்வு செய்யவும்');
        return;
      }

      const payload = {
        form10_society_id: this.selectedSociety.form10_society_id,
        candidates: continuing.map(c => ({ form5_member_id: c.form5_member_id }))
      };

      this.userService.form10withdraw(payload).subscribe({
        next: (res: any) => {
          if (res?.success) {
            alert('சேமிக்கப்பட்டது');
            this.closeModal();
            this.loadPreview();
          }
        },
        error: err => alert(err?.error?.message || 'API error')
      });

      return;
    }

    // ==========================
    // TABLE 2 → REJECT
    //
    // CHECKED   = candidate continues to TABLE 4/UNOPPOSED
    // UNCHECKED = candidate is rejected
    //
    // The backend's candidates[] payload is the KEEP list — anyone
    // NOT included gets marked REJECTED automatically. So we send
    // the checked (continuing) candidates, not the unchecked ones.
    // ==========================

    const continuing = this.candidates.filter(c => c.is_elected);

    if (continuing.length === 0) {
      alert('குறைந்தது ஒரு உறுப்பினரையாவது தொடர தேர்வு செய்யவும்');
      return;
    }

    const payload = {
      form10_society_id: this.selectedSociety.form10_society_id,
      candidates: continuing.map(c => ({ form5_member_id: c.form5_member_id }))
    };

    this.userService.form10reject(payload).subscribe({
      next: (res: any) => {
        if (res?.success) {
          alert('சேமிக்கப்பட்டது');
          this.closeModal();
          this.loadPreview();
        }
      },
      error: err => alert(err?.error?.message || 'API error')
    });
  }

  submitForm10(): void {

    if (this.isFormSubmitted) return;

    // ==========================================
    // CHECK ALL SOCIETIES HAVE A FINAL RESULT
    //
    // Pulled fresh from the last loadPreview() response, not just
    // the local finalizedSocieties Set — the backend is still the
    // final authority and will reject form10submit() if anything
    // was missed.
    // ==========================================

    const pendingCount =
      this.firstSelectionList.length +
      this.f4List.length +
      this.f5List.filter((row: any) => !row.submitted).length;

    if (pendingCount > 0) {
      alert(`${pendingCount} சங்கங்கள் இன்னும் இறுதி செய்யப்படவில்லை.`);
      return;
    }

    const payload = {
      form10_id: this.form10_id
    };

    this.userService.form10submit(payload).subscribe({
      next: (res: any) => {
        if (res?.success) {
          alert('Form10 Submitted Successfully');
          this.isFormSubmitted = true;
          this.router.navigate(['/layout/totalforms']);
        }
      },
      error: err => alert(err?.error?.message || 'Submit failed')
    });
  }

  goBack(): void {
    window.history.back();
  }
}
