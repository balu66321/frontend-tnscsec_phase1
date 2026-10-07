import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user';
import { FilterByCategoryPipe } from '../../pipes/filter-by-category-pipe';
import { Router, RouterOutlet } from '@angular/router';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-form6',
  standalone: true,
  imports: [CommonModule, FormsModule, FilterByCategoryPipe,],
  templateUrl: './form6.html',
  styleUrls: ['./form6.css']
})
export class Form6 implements OnInit {

  district_name = '';
  zone_name = '';
  form6_id!: number;

  // 🔥 NEW SEPARATION
  f3Societies: any[] = [];   // STATIC
  f4Societies: any[] = [];   // WORKING LIST

  showRejectPopup = false;
  showStopPopup = false;
  showFinalSubmitPopup = false;
  form6Submitted = false;
  isEditMode = false;
  editableData: any = null;


  selectedSociety: any = null;
  stopRemark = '';

  // Captured once, when the popup opens — whether this society was
  // UNOPPOSED before any interaction (checkbox grid hidden, no choice to
  // make). Must NOT be re-derived from the live/simulated election_status,
  // since checking boxes can simulate the society INTO 'UNOPPOSED' too —
  // that case must still submit the boxes actually checked, not auto-pick
  // members[0].
  wasInitiallyUnopposed = false;

  f5List: any[] = [];
  f6List: any[] = [];
  f7List: any[] = [];

  // Societies whose withdrawal was actually submitted (moved out of
  // f4Societies into f5/f6/f7) — the only ones with a real withdrawn
  // count. Kept separately so it's not tied to which outcome list a
  // society lands in.
  processedSocieties: any[] = [];

  showViewPopup = false;
  viewSociety: any = null;

  constructor(private userService: UserService, private router: Router) { }

  // ngOnInit(): void {
  //   this.district_name = localStorage.getItem('district_name') || '';
  //   this.zone_name = localStorage.getItem('zone_name') || '';
  //   this.initForm6();
  // }
  ngOnInit(): void {

    this.district_name = localStorage.getItem('district_name') || '';
    this.zone_name = localStorage.getItem('zone_name') || '';

    // First initialize Form6 to get form6_id
    this.initForm6();
  }

  initForm6() {

    this.userService.initForm6().subscribe(res => {

      if (res?.success) {

        this.form6_id = res.data.form6_id;

        // Save for later use
        localStorage.setItem('form6_id', this.form6_id.toString());

        // Now load editable data
        this.loadPreview();
        //this.loadEditableForm6();
      }

    });

  }

  loadEditableForm6() {

    this.userService.getEditableForm6().subscribe({

      next: (res: any) => {

        this.editableData = res.data;

        // Only enable edit mode if there are already withdrawn members
        // this.isEditMode = res.data.societies.some((soc: any) =>
        //   soc.election_status !== 'QUALIFIED'
        // );
        this.isEditMode = res.data.societies.some(
          (soc: any) =>
            soc.members.some((m: any) => m.withdrawn === true)
        );

        this.loadPreview();

      },

      error: () => {

        this.isEditMode = false;

        this.initForm6();

      }

    });

  }
  /* ================= PREVIEW ================= */
  loadPreview() {
    this.userService.getForm6Preview().subscribe(res => {
      if (!res?.success) return;

      // const prepared = res.data.societies.map((s: any) => ({
      const prepared = res.data.societies
        .filter((s: any) => Number(s.active_counts?.total || 0) > 0)
        .map((s: any) => ({
          ...s,

          // Rural Counts
          rural_sc_st: +s.rural.sc_st,
          rural_women: +s.rural.women,
          rural_general: +s.rural.general,
          rural_total:
            +s.rural.sc_st +
            +s.rural.women +
            +s.rural.general,

          // Declared Counts
          declared_sc_st: +s.declared.sc_st,
          declared_women: +s.declared.women,
          declared_general: +s.declared.general,
          declared_total:
            +s.declared.sc_st +
            +s.declared.women +
            +s.declared.general,

          // Active Counts (existing)
          sc_st: +s.active_counts.sc_st,
          women: +s.active_counts.women,
          general: +s.active_counts.general,
          total: +s.active_counts.total,

          rejectDone: false,
          stopDone: false,

          members: s.members.map((m: any) => ({
            ...m,
            checked: false,
            withdrawn: false
          }))
        }));

      this.f3Societies = JSON.parse(JSON.stringify(prepared)); // snapshot
      this.f4Societies = prepared; // working list
      this.processedSocieties = [];
    });
  }



  /* ================= REJECT ================= */
  // openRejectPopup(soc: any) {
  //   this.selectedSociety = soc;
  //   this.showRejectPopup = true;
  // }

  openRejectPopup(soc: any) {

    if (this.isEditMode && this.editableData?.societies) {

      const editableSoc = this.editableData.societies.find(
        (x: any) =>
          x.form4_filed_soc_id === soc.form4_filed_soc_id
      );

      if (editableSoc) {

        this.selectedSociety = {
          ...soc,
          members: editableSoc.members.map((m: any) => ({
            ...m,
            checked: m.withdrawn === true,
            withdrawn: m.withdrawn === true
          }))
        };

      } else {

        this.selectedSociety = soc;
      }

    } else {

      this.selectedSociety = soc;
    }

    this.wasInitiallyUnopposed = this.selectedSociety.election_status === 'UNOPPOSED';
    this.showRejectPopup = true;
  }
  closeReject() {
    this.showRejectPopup = false;
    this.selectedSociety = null;
  }

  getMembers(type: string) {
    return this.selectedSociety?.members.filter(
      (m: any) => m.category_type === type
    ) || [];
  }

  /* ================= SIMULATE ================= */
  onCheckboxChange() {
    const ids = this.selectedSociety.members
      .filter((m: any) => m.checked)
      .map((m: any) => m.id);

    if (!ids.length) return;

    this.userService.simulateForm6({
      form4_filed_soc_id: this.selectedSociety.form4_filed_soc_id,
      withdraw_member_ids: ids
    }).subscribe(res => {
      if (!res?.success) return;

      this.selectedSociety.election_status = res.data.election_status;

      //   res.data.members.forEach((apiM: any) => {
      //     const local = this.selectedSociety.members.find(
      //       (m: any) => m.id === apiM.id
      //     );
      //     if (local) local.withdrawn = apiM.withdrawn;

      res.data.members.forEach((apiM: any) => {

        const local = this.selectedSociety.members.find(
          (m: any) => m.id === apiM.id
        );

        if (local) {
          local.withdrawn = apiM.withdrawn;
        }
      });

      this.updateCounts(this.selectedSociety);
    });


  }

  /* ================= FINAL WITHDRAW ================= */
  finalWithdraw() {

    let membersToWithdraw: any[] = [];

    if (this.wasInitiallyUnopposed) {

      // Only auto-pick members[0] when the society was UNOPPOSED from the
      // start (no checkboxes were ever offered). If it only became
      // UNOPPOSED via the live simulation after the officer checked boxes,
      // those checked members are what must actually be withdrawn.
      membersToWithdraw = [this.selectedSociety.members[0]];

    } else {

      membersToWithdraw = this.selectedSociety.members.filter(
        (m: any) => m.checked || m.withdrawn
      );

    }

    if (!membersToWithdraw.length) {
      alert('தயவுசெய்து உறுப்பினரை தேர்வு செய்யவும்');
      return;
    }

    // ================= EDIT =================

    if (this.isEditMode) {
      console.log('IS EDIT MODE =', this.isEditMode);
      console.log('FORM6 ID =', this.form6_id);
      console.log('SELECTED SOCIETY =', this.selectedSociety);


      const payload = {


        form6_id: this.form6_id,


        candidate_events: membersToWithdraw.map((m: any) => ({

          form4_filed_soc_id: this.selectedSociety.form4_filed_soc_id,

          form5_member_id: m.form5_member_id ?? m.id,

          event_type: 'WITHDRAW'

        })),

        societies: [

          {

            form4_filed_soc_id: this.selectedSociety.form4_filed_soc_id,

            election_action: this.selectedSociety.election_status,

            remarks: null

          }

        ]

      };

      console.log('EDIT PAYLOAD', payload);

      this.userService.editForm6(payload).subscribe((res: any) => {

        if (res.success) {

          alert('✔ Form6 Updated Successfully');

          this.closeReject();

          this.loadEditableForm6();

        }

      });

    }

    // ================= FIRST SUBMIT =================

    else {

      // Send one at a time — firing all of these in parallel meant each
      // withdrawForm6 response reflected whatever partial state the backend
      // happened to be in at that moment (a race), so neither "last response
      // to arrive" nor any single response's election_status could be
      // trusted as the true final state. Sequencing them removes that.
      const withdrawNext = (index: number) => {

        if (index >= membersToWithdraw.length) {

          // Mark them withdrawn locally, then derive the final status the
          // same way the backend does (rural vs. the real active counts) —
          // instead of trusting any one intermediate API response.
          membersToWithdraw.forEach((m: any) => (m.withdrawn = true));

          this.updateCounts(this.selectedSociety);
          this.selectedSociety.election_status = this.computeElectionStatus(this.selectedSociety);

          this.moveSocietyAfterSubmit(this.selectedSociety);
          this.closeReject();

          return;
        }

        const m = membersToWithdraw[index];

        this.userService.withdrawForm6({

          form6_id: this.form6_id,

          form5_member_id: m.form5_member_id ?? m.id,

          action: 'WITHDRAW'

        }).subscribe(() => {

          withdrawNext(index + 1);

        });
      };

      withdrawNext(0);

    }

  }

  /* ================= CLIENT-SIDE ELECTION STATUS ================= */
  // Mirrors the backend's getElectionStatus(rural, final): all three
  // categories equal to the required seats -> UNOPPOSED; any category still
  // above the required seats -> QUALIFIED; otherwise -> UNQUALIFIED.
  private computeElectionStatus(soc: any): 'UNOPPOSED' | 'QUALIFIED' | 'UNQUALIFIED' {

    const allEqual =
      soc.rural_sc_st === soc.sc_st &&
      soc.rural_women === soc.women &&
      soc.rural_general === soc.general;

    if (allEqual) return 'UNOPPOSED';

    const hasIncrease =
      soc.sc_st > soc.rural_sc_st ||
      soc.women > soc.rural_women ||
      soc.general > soc.rural_general;

    return hasIncrease ? 'QUALIFIED' : 'UNQUALIFIED';
  }
  /* ================= MOVE SOCIETY ================= */
  private moveSocietyAfterSubmit(soc: any) {

    soc.candidates = soc.members
      .filter((m: any) => !m.withdrawn)
      .map((m: any) => ({
        member_name: m.member_name,
        category_type: m.category_type
      }));

    this.f4Societies = this.f4Societies.filter(
      s => s.form4_filed_soc_id !== soc.form4_filed_soc_id
    );

    if (soc.election_status === 'UNOPPOSED') this.f5List.push(soc);
    else if (soc.election_status === 'UNQUALIFIED') this.f6List.push(soc);
    else if (soc.election_status === 'QUALIFIED') this.f7List.push(soc);

    this.processedSocieties.push(soc);
  }

  /* ================= VIEW ================= */
  openViewPopup(soc: any) {

    // f5/f6/f7 rows already carry a built `candidates` list (see
    // moveSocietyAfterSubmit); this table's rows only have `members`,
    // so derive the same shape from the active (non-withdrawn) ones.
    const candidates = soc.candidates?.length
      ? soc.candidates
      : (soc.members || [])
        .filter((m: any) => !m.withdrawn)
        .map((m: any) => ({
          member_name: m.member_name,
          category_type: m.category_type
        }));

    this.viewSociety = { ...soc, candidates };
    this.showViewPopup = true;
  }

  closeViewPopup() {
    this.viewSociety = null;
    this.showViewPopup = false;
  }

  /* ================= STOP ================= */
  openStopPopup(soc: any) {
    this.selectedSociety = soc;
    this.stopRemark = '';
    this.showStopPopup = true;
  }

  closeStop() {
    this.showStopPopup = false;
    this.selectedSociety = null;
  }

  submitStop() {
    this.userService.stopElectionForm6({
      form6_id: this.form6_id,
      form4_filed_soc_id: this.selectedSociety.form4_filed_soc_id,
      action: 'STOP',
      remark: this.stopRemark
    }).subscribe(res => {
      if (res?.success) {
        this.selectedSociety.stopDone = true;
        this.closeStop();
      }
    });
  }

  /* ================= WITHDRAWN COUNT (CATEGORY-WISE) ================= */
  getWithdrawnCount(soc: any, type: string): number {
    return (soc.members || []).filter(
      (m: any) => m.category_type === type && m.withdrawn
    ).length;
  }

  getWithdrawnTotal(soc: any): number {
    return (soc.members || []).filter((m: any) => m.withdrawn).length;
  }

  //newly added method

  updateCounts(soc: any) {

    const activeMembers = soc.members.filter((m: any) => !m.withdrawn);

    soc.sc_st = activeMembers.filter(
      (m: any) => m.category_type === 'sc_st'
    ).length;

    soc.women = activeMembers.filter(
      (m: any) => m.category_type === 'women'
    ).length;

    soc.general = activeMembers.filter(
      (m: any) => m.category_type === 'general'
    ).length;

    soc.total = soc.sc_st + soc.women + soc.general;
  }

  /* ================= FINAL FORM 6 SUBMIT ================= */
  submitForm6Final() {
    if (this.form6Submitted) return;

    this.userService.submitForm6({
      form6_id: this.form6_id
    }).subscribe(res => {
      if (res?.success) {

        this.form6Submitted = true;
        this.showFinalSubmitPopup = true;

        alert('Form 6 submitted successfully');

        this.router.navigate(['/layout/totalforms']);
      }
    });
  }
}