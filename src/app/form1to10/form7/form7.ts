import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user';
import { Router } from '@angular/router';


@Component({
  selector: 'app-form7',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './form7.html',
  styleUrls: ['./form7.css']
})
export class Form7 implements OnInit {

  district_name = '';
  Zone_name = '';
  isEditMode = false;
  editableData: any = null;
  form7_id!: number;

  // F3 – Rural counts
  f3Societies: any[] = [];

  // F4 – Eligible counts
  f4Societies: any[] = [];

  // F5 – Final input table
  f5Data: any[] = [];

  readonly reasonOptions = [
    { value: 'legal_order', label: 'சட்ட ஒழுங்கு' },
    { value: 'natural_disaster', label: 'இயற்கை பேரிடர்' },
    { value: 'court_injunction', label: 'நீதிமன்ற தடையாணை' },
    { value: 'election_cancelled_by_commission', label: 'ஆணையத்தால் தேர்தல் ரத்து' },
    { value: 'insufficient_quorum', label: 'சிற்றெண் குறைவு' },
    { value: 'other', label: 'இதர காரணங்கள்' }
  ];

  constructor(private userService: UserService, private router: Router) { }
  // ngOnInit(): void {
  //   this.district_name = localStorage.getItem('district_name') || '';
  //   this.Zone_name = localStorage.getItem('zone_name') || '';
  //   this.loadPreview();

  // }
  ngOnInit(): void {

    console.log('Form7 ngOnInit');

    this.district_name = localStorage.getItem('district_name') || '';
    this.Zone_name = localStorage.getItem('zone_name') || '';

    this.loadEditableForm7();
  }




  loadEditableForm7() {

    this.userService.getEditableForm7().subscribe({

      next: (res: any) => {

        this.editableData = res.data;

        // If societies exist, it's edit mode
        this.isEditMode = res.data.societies?.length > 0;

        if (res.data.form7_id) {
          this.form7_id = res.data.form7_id;
        }

        console.log('EDIT MODE:', this.isEditMode);
        console.log('EDIT DATA:', this.editableData);

        this.loadPreview();

      },

      error: () => {

        this.isEditMode = false;

        this.loadPreview();

      }

    });

  }


  /* ================= PREVIEW ================= */
  // loadPreview() {

  //   this.userService.getForm7Preview().subscribe(res => {

  //     if (!res?.success) return;

  //     const societies = res.data.societies;

  //     // Remove duplicates
  //     const uniqueMap = new Map();

  //     societies.forEach((s: any) => {
  //       uniqueMap.set(s.society_id, s);
  //     });

  //     const uniqueSocieties = Array.from(uniqueMap.values());

  //     /* ================= F3 ================= */

  //     this.f3Societies = uniqueSocieties.map((s: any) => ({

  //       society_id: s.society_id,
  //       society_name: s.society_name,

  //       sc_st: +s.rural.sc_st,
  //       women: +s.rural.women,
  //       general: +s.rural.general,

  //       total: +s.rural.total_voters

  //     }));

  //     /* ================= F4 ================= */

  //     this.f4Societies = uniqueSocieties.map((s: any) => {

  //       const scst = s.qualified_categories.sc_st;
  //       const women = s.qualified_categories.women;
  //       const general = s.qualified_categories.general;

  //       const sc_st_count = scst.eligible ? scst.count : 0;
  //       const women_count = women.eligible ? women.count : 0;
  //       const general_count = general.eligible ? general.count : 0;

  //       return {

  //         society_id: s.society_id,
  //         society_name: s.society_name,

  //         sc_st: sc_st_count,
  //         women: women_count,
  //         general: general_count,

  //         total: sc_st_count + women_count + general_count

  //       };

  //     });


  /* ================= F5 ================= */

  // this.f5Data = this.f4Societies.map(f4 => ({

  //   society_id: f4.society_id,
  //   society_name: f4.society_name,

  //   final_sc_st_count: f4.sc_st,
  //   final_women_count: f4.women,
  //   final_general_count: f4.general,

  //   form3_total: f4.total,

  //   casted_votes_count: 0,
  //   voting_percentage: 0,

  //   ballot_box_count: 0,
  //   stamp_count: 0,

  //   polling_stations_count: 0,
  //   election_officers_count: 0,

  //   polling_suspension_count: 'NO_ISSUES'

  // }));



  loadPreview() {

    this.userService.getForm7Preview().subscribe(res => {

      if (!res?.success) return;

      const societies = res.data.societies || [];

      // Only QUALIFIED societies should be shown in Form 7
      const qualifiedSocieties = societies.filter(
        (s: any) => s.election_status === 'QUALIFIED'
      );

      console.log('All societies:', societies);
      console.log('Qualified societies:', qualifiedSocieties);

      // Remove duplicates
      const uniqueMap = new Map();

      qualifiedSocieties.forEach((s: any) => {
        uniqueMap.set(s.society_id, s);
      });

      const uniqueSocieties = Array.from(uniqueMap.values());

      /* ================= F3 ================= */

      this.f3Societies = uniqueSocieties.map((s: any) => ({

        society_id: s.society_id,
        society_name: s.society_name,

        sc_st: +s.rural.sc_st,
        women: +s.rural.women,
        general: +s.rural.general,

        total: +s.rural.total_voters

      }));


      /* ================= F4 ================= */

      this.f4Societies = uniqueSocieties.map((s: any) => {

        const scst = s.qualified_categories.sc_st;
        const women = s.qualified_categories.women;
        const general = s.qualified_categories.general;

        const sc_st_count = scst.eligible ? scst.count : 0;
        const women_count = women.eligible ? women.count : 0;
        const general_count = general.eligible ? general.count : 0;

        return {

          society_id: s.society_id,
          society_name: s.society_name,

          sc_st: sc_st_count,
          women: women_count,
          general: general_count,

          total:
            sc_st_count +
            women_count +
            general_count

        };

      });


      /* ================= F5 ================= */

      // form3_total must be the real voter-list total from Form3
      // (s.form3_total), NOT f4Societies' declared/eligible candidate
      // count — those are unrelated numbers that happened to share a name.
      const form3TotalMap = new Map(
        uniqueSocieties.map((s: any) => [s.society_id, s.form3_total ?? 0])
      );

      this.f5Data = this.f4Societies.map(f4 => ({

        society_id: f4.society_id,
        society_name: f4.society_name,

        final_sc_st_count: f4.sc_st,
        final_women_count: f4.women,
        final_general_count: f4.general,

        form3_total: form3TotalMap.get(f4.society_id) ?? f4.total,
        polling_date: '',

        casted_votes_count: 0,
        voting_percentage: 0,

        ballot_box_count: 0,
        stamp_count: 0,

        polling_stations_count: 0,
        election_officers_count: 0,

        polling_suspension_count: 'NO_ISSUES',

        stop_reason: '',
        stop_other_reason_text: ''

      }));


      /* ================= EDITABLE ================= */

      if (this.isEditMode && this.editableData?.societies) {

        this.f5Data = this.f5Data.map(row => {

          const edit = this.editableData.societies.find(
            (x: any) => x.society_id === row.society_id
          );

          if (!edit) {
            return row;
          }

          return {

            ...row,

            polling_date: edit.polling_date
              ? String(edit.polling_date).slice(0, 10)
              : '',

            casted_votes_count: edit.casted_votes_count,
            voting_percentage: Number(edit.voting_percentage),

            ballot_box_count: edit.ballot_box_count,
            stamp_count: edit.stamp_count,

            polling_stations_count: edit.polling_stations_count,
            election_officers_count: edit.election_officers_count,

            polling_suspension_count:
              edit.polling_suspension_count,

            stop_reason: edit.stop_reason || '',
            stop_other_reason_text: edit.stop_other_reason_text || ''

          };

        });

      }

    });

  }

  /* ================= EDITABLE ================= */

  /* ================= EDITABLE ================= */

  //     if (this.isEditMode && this.editableData?.societies) {

  //       this.f5Data = this.f5Data.map(row => {

  //         const edit = this.editableData.societies.find(
  //           (x: any) => x.society_id === row.society_id
  //         );

  //         if (!edit) {
  //           return row;
  //         }

  //         return {

  //           ...row,

  //           casted_votes_count: edit.casted_votes_count,
  //           voting_percentage: Number(edit.voting_percentage),

  //           ballot_box_count: edit.ballot_box_count,
  //           stamp_count: edit.stamp_count,

  //           polling_stations_count: edit.polling_stations_count,
  //           election_officers_count: edit.election_officers_count,

  //           polling_suspension_count: edit.polling_suspension_count

  //         };

  //       });

  //     }

  //   });   // <-- closes subscribe

  // }      // <-- closes loadPreview()
  /* ================= RULE SELECT ================= */
  setRule(row: any, rule: string, event: any) {
    if (event.target.checked) {
      row.polling_suspension_count = rule;
    } else {
      row.polling_suspension_count = 'NO_ISSUES';
    }
  }

  /* ================= AUTO % ================= */
  calculatePercentage(row: any) {
    if (row.form3_total > 0) {
      row.voting_percentage =
        ((row.casted_votes_count / row.form3_total) * 100).toFixed(2);
    } else {
      row.voting_percentage = 0;
    }
  }

  /* ================= CANCEL ================= */
  onCancel() {
    window.history.back();
  }

  /* ================= SUBMIT ================= */
  onSubmit() {

    /* ================= EDIT ================= */

    if (this.isEditMode) {

      const payload = {

        form7_id: this.form7_id,

        societies: this.f5Data.map(row => ({

          society_id: row.society_id,
          society_name: row.society_name,

          final_sc_st_count: row.final_sc_st_count,
          final_women_count: row.final_women_count,
          final_general_count: row.final_general_count,

          form3_total: row.form3_total,
          polling_date: row.polling_date || '',

          casted_votes_count: row.casted_votes_count,
          voting_percentage: Number(row.voting_percentage),

          ballot_box_count: row.ballot_box_count,
          stamp_count: row.stamp_count,

          polling_stations_count: row.polling_stations_count,
          election_officers_count: row.election_officers_count,

          polling_suspension_count: row.polling_suspension_count,

          stop_reason: row.stop_reason || '',
          stop_other_reason_text: row.stop_other_reason_text || ''

        }))

      };

      console.log(payload);

      this.userService.editForm7(payload).subscribe({

        next: (res: any) => {

          alert('Form7 Updated Successfully');
          this.router.navigate(['/layout/totalforms']);


          // this.loadEditableForm7();

        },

        error: (err) => {

          console.log(err);

        }

      });
    }


    /* ================= FIRST SUBMIT ================= */

    else {

      const payload = {

        societies: this.f5Data.map(row => ({

          society_id: row.society_id,
          society_name: row.society_name,

          final_sc_st_count: row.final_sc_st_count,
          final_women_count: row.final_women_count,
          final_general_count: row.final_general_count,

          form3_total: row.form3_total,
          polling_date: row.polling_date || '',
          casted_votes_count: row.casted_votes_count,
          voting_percentage: Number(row.voting_percentage),

          ballot_box_count: row.ballot_box_count,
          stamp_count: row.stamp_count,

          polling_stations_count: row.polling_stations_count,
          election_officers_count: row.election_officers_count,

          polling_suspension_count: row.polling_suspension_count,

          stop_reason: row.stop_reason || '',
          stop_other_reason_text: row.stop_other_reason_text || ''

        }))

      };

      console.log(payload);

      this.userService.submitForm7(payload).subscribe({

        next: (res: any) => {

          alert('Form7 Submitted Successfully');


          // this.loadEditableForm7();
          this.router.navigate(['/layout/totalforms']);


        }

      });

    }

  }
}