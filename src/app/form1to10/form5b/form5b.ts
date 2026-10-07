import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user';
import { Router } from '@angular/router';

@Component({
  selector: 'app-form5b',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form5b.html',
  styleUrls: ['./form5b.css']
})

export class Form5b implements OnInit {

  district_name = '';
  zone_name = '';


  f3Societies: any[] = [];
  f4Societies: any[] = [];

  selectedSociety: any = null;

  showRejectPopup = false;
  showStopPopup = false;
  showFinalSubmitPopup = false;

  stopReason = '';
  stopOtherReasonText: string | null = null;

  readonly reasonOptions = [
    { value: 'legal_order', label: 'சட்ட ஒழுங்கு' },
    { value: 'natural_disaster', label: 'இயற்கை பேரிடர்' },
    { value: 'court_injunction', label: 'நீதிமன்ற தடையாணை' },
    { value: 'election_cancelled_by_commission', label: 'ஆணையத்தால் தேர்தல் ரத்து' },
    { value: 'insufficient_candidates', label: 'சிற்றெண் குறைவு' },
    { value: 'other', label: 'இதர காரணங்கள்' }
  ];

  isEditMode = false;
  editableData: any = null;
  formSubmitted = false;


  constructor(
    private userService: UserService,
    private router: Router
  ) { }

  // ngOnInit(): void {


  //   this.district_name = localStorage.getItem('district_name') || '';
  //   this.zone_name = localStorage.getItem('zone_name') || '';

  //   this.loadPreview();
  // }


  ngOnInit(): void {

    this.district_name = localStorage.getItem('district_name') || '';
    this.zone_name = localStorage.getItem('zone_name') || '';

    this.loadEditableForm5b();
  }
  loadEditableForm5b() {

    this.userService.getEditableForm5b().subscribe({

      next: (res: any) => {
        console.log(this.userService);



        this.isEditMode = true;
        this.editableData = res.data;
        console.log('Editable Societies:', this.editableData?.societies);


        this.loadPreview();
      },

      error: () => {

        this.isEditMode = false;

        this.loadPreview();
      }
    });
  }



  /* ================= PREVIEW ================= */

  /* ================= PREVIEW ================= */

  loadPreview() {

    const form4Id = Number(localStorage.getItem('form4_id'));

    this.userService.getForm5bpreview(form4Id).subscribe(res => {

      if (!res?.success) return;

      console.log('SOCIETIES:', res.data.societies);

      const prepared = res.data.societies.map((s: any) => {

        const activeMembers = s.members.filter(
          (m: any) => m.is_active === true
        );

        return {

          ...s,

          sc_st: activeMembers.filter(
            (m: any) => m.category_type === 'sc_st'
          ).length,

          women: activeMembers.filter(
            (m: any) => m.category_type === 'women'
          ).length,

          general: activeMembers.filter(
            (m: any) => m.category_type === 'general'
          ).length,

          total: activeMembers.length,

          // Default button text
          rejectDone: false,

          stopDone: s.is_stopped === true,

          members: s.members.map((m: any) => ({
            ...m,
            checked: false
          }))
        };

      });

      this.f3Societies = JSON.parse(JSON.stringify(prepared));
      this.f4Societies = JSON.parse(JSON.stringify(prepared));

      console.log('F4 Societies:', this.f4Societies);

    });

  }

  openRejectPopup(soc: any) {

    if (this.isEditMode && this.editableData?.societies) {

      const editableSoc = this.editableData.societies.find(
        (x: any) => x.form4_filed_soc_id === soc.form4_filed_soc_id
      );

      if (editableSoc) {

        this.selectedSociety = {
          ...soc,
          members: editableSoc.members.map((m: any) => ({
            ...m,
            checked: !m.is_active   // previously withdrawn = checked
          }))
        };

      } else {

        this.selectedSociety = soc;
      }

    } else {

      this.selectedSociety = soc;
    }

    console.log('SELECTED SOCIETY', this.selectedSociety);

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

  /* ================= FINAL WITHDRAW ================= */

  finalWithdraw() {

    const candidateIds = this.selectedSociety.members
      .filter((m: any) => m.checked)
      .map((m: any) => m.id);

    // if (!candidateIds.length) {
    //   alert('தயவுசெய்து உறுப்பினரை தேர்வு செய்யவும்');
    //   return;
    // }

    /* ===== EDIT MODE ===== */
    if (this.isEditMode) {

      const payload = {
        updates: candidateIds.map((id: number) => ({
          form5_id: id,
          member_name: '',
          aadhar_no: ''
        }))
      };

      console.log('EDIT PAYLOAD', payload);

      this.userService.editForm5b(payload).subscribe((res: any) => {

        if (res?.success) {

          const soc = this.f4Societies.find(
            (x: any) =>
              x.form4_filed_soc_id === this.selectedSociety.form4_filed_soc_id
          );

          if (soc) {
            soc.rejectDone = true;
          }

          alert('✔ Form5B Updated Successfully');

          this.closeReject();
        }

      });

    }

    /* ===== ADD MODE ===== */
    else {

      const payload = {
        candidate_ids: candidateIds
      };

      this.userService.postcandidatestop(payload).subscribe((res: any) => {

        if (res?.success) {

          const soc = this.f4Societies.find(
            (x: any) =>
              x.form4_filed_soc_id === this.selectedSociety.form4_filed_soc_id
          );

          if (soc) {

            soc.members.forEach((m: any) => {

              if (candidateIds.includes(m.id)) {
                m.is_active = false;
              }

            });

            const activeMembers = soc.members.filter(
              (m: any) => m.is_active === true
            );

            soc.sc_st = activeMembers.filter(
              (m: any) => m.category_type === 'sc_st'
            ).length;

            soc.women = activeMembers.filter(
              (m: any) => m.category_type === 'women'
            ).length;

            soc.general = activeMembers.filter(
              (m: any) => m.category_type === 'general'
            ).length;

            soc.total = activeMembers.length;

            // Button text change after submit
            soc.rejectDone = true;
          }

          alert('✔ Form5B Submitted Successfully');

          this.closeReject();
        }

      });
    }
  }
  /* ================= STOP ELECTION ================= */

  openStopPopup(soc: any) {

    this.selectedSociety = soc;
    // '' (not null) so it matches the dropdown's placeholder <option value="">
    this.stopReason = soc.stop_reason || '';
    this.stopOtherReasonText = soc.stop_other_reason_text || null;

    this.showStopPopup = true;

  }

  closeStop() {

    this.showStopPopup = false;
    this.selectedSociety = null;

  }


  // cancel() {
  //   window.history.back();ss
  // }
  submitStop() {

    if (!this.stopReason) {

      alert('தேர்தல் நிறுத்துவதற்கான காரணத்தை தேர்வு செய்யவும்');
      return;

    }

    const payload = {

      form4_filed_soc_id: this.selectedSociety.form4_filed_soc_id,
      reason: this.stopReason,
      other_reason_text: this.stopReason === 'other' ? (this.stopOtherReasonText || '') : null

    };

    this.userService.postsocietystop(payload).subscribe(res => {

      if (res?.success) {

        this.selectedSociety.stopDone = true;
        this.selectedSociety.stop_reason = this.stopReason;
        this.selectedSociety.stop_other_reason_text = payload.other_reason_text;

        this.closeStop();

      }

    });

  }

  /* ================= FINAL SUBMIT ================= */

  submitForm5bFinal() {

    if (this.formSubmitted) return;

    this.userService.submitForm5b({}).subscribe(res => {

      if (res?.success) {

        this.formSubmitted = true;

        this.showFinalSubmitPopup = true;

        setTimeout(() => {

          this.router.navigate(['/layout/totalforms']);

        }, 1500);

      }

    });

  }

}