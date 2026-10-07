import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { saveAs } from 'file-saver';
import { UserService } from '../services/user';

interface StoppedRow {
  district_name: string;
  zone_name: string;
  society_name: string;
  stage: string;
  reason: string;
}

// Same reason codes as Form4 / Form5b (shared verbatim) plus Form7's
// 'insufficient_quorum' alias for the same label, and Form1's own set.
const FORM1_REASONS: Record<string, string> = {
  address_unknown: 'முகவரி தெரியவில்லை',
  defunct_societies: 'செயலிழந்த சங்கங்கள்',
  dissolution_notice_issued: 'கலைத்தல் அறிவிப்பு வழங்கப்பட்டவை',
  other: 'இதர காரணம்'
};

const STOP_REASONS: Record<string, string> = {
  legal_order: 'சட்ட ஒழுங்கு',
  natural_disaster: 'இயற்கை பேரிடர்',
  court_injunction: 'நீதிமன்ற தடையாணை',
  election_cancelled_by_commission: 'ஆணையத்தால் தேர்தல் ரத்து',
  insufficient_candidates: 'சிற்றெண் குறைவு',
  insufficient_quorum: 'சிற்றெண் குறைவு',
  other: 'இதர காரணங்கள்'
};

function resolveReason(map: Record<string, string>, value: string | undefined, otherText?: string): string {
  if (!value) return '-';
  const label = map[value] || value;
  return value === 'other' && otherText ? `${label} - ${otherText}` : label;
}

@Component({
  selector: 'app-form8overallstoppedsocieties',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './form8overallstoppedsocieties.html',
  styleUrls: ['./form8overallstoppedsocieties.css']
})
export class Form8OverallStoppedSocieties implements OnInit {

  rows: StoppedRow[] = [];
  department_name = '';

  constructor(private userService: UserService) { }

  ngOnInit(): void {

    // Each call fails on its own (catchError -> null) so one form's
    // missing/errored data doesn't blank out the whole combined table.
    const safe = (obs: any) => obs.pipe(catchError((err: any) => {
      console.error('form8overallstoppedsocieties: source call failed', err);
      return of(null);
    }));

    forkJoin({
      f1: safe(this.userService.getForm1Table()),
      f4: safe(this.userService.getForm4Table()),
      f5b: safe(this.userService.getForm5blisttable()),
      f6: safe(this.userService.getForm6Table()),
      f7: safe(this.userService.getForm7Table())
    }).subscribe(({ f1, f4, f5b, f6, f7 }: any) => {

      this.department_name = localStorage.getItem('department_name') || '';

      const rows: StoppedRow[] = [];

      // ===== Form1 — societies not given an election notice =====
      (f1?.data?.data || []).forEach((item: any) => {
        (item.non_selected_soc || []).forEach((s: any) => {
          if (!s.reason) return;
          rows.push({
            district_name: item.district_name || '-',
            zone_name: item.zone_name || '-',
            society_name: s.society_name || '-',
            stage: 'படிவம் 1',
            reason: resolveReason(FORM1_REASONS, s.reason, s.other_reason_text)
          });
        });
      });

      // ===== Form4 — nomination not filed =====
      (f4?.data?.data || []).forEach((item: any) => {
        (item.unfiled_societies || []).forEach((s: any) => {
          if (!s.reason) return;
          rows.push({
            district_name: item.district?.name || '-',
            zone_name: item.zone?.name || '-',
            society_name: s.society_name || '-',
            stage: 'படிவம் 4',
            reason: resolveReason(STOP_REASONS, s.reason, s.other_reason_text)
          });
        });
      });

      // ===== Form5b — election stopped after scrutiny =====
      (f5b?.data?.data || []).forEach((item: any) => {
        (item.stopped_societies || []).forEach((s: any) => {
          rows.push({
            district_name: item.district_name || '-',
            zone_name: item.zone_name || '-',
            society_name: s.society_name || '-',
            stage: 'படிவம் 5b',
            reason: resolveReason(STOP_REASONS, s.stop_reason, s.stop_other_reason_text)
          });
        });
      });

      // ===== Form7 — election stopped during polling =====
      const f7Data = f7?.data?.[0];
      (f7Data?.societies || []).forEach((s: any) => {
        const reasonValue = s.submitted_data?.stop_reason;
        if (!reasonValue) return;
        rows.push({
          district_name: f7Data?.district?.name || '-',
          zone_name: s.zone_name || '-',
          society_name: s.society_name || '-',
          stage: 'படிவம் 7',
          reason: resolveReason(STOP_REASONS, reasonValue, s.submitted_data?.stop_other_reason_text)
        });
      });

      // ===== Form6 — election stopped at the scrutiny/withdrawal stage =====
      // election_action is the real stop flag (STOP vs SHOW); Form6 has no
      // coded reason like the other forms, only the free-text remark typed
      // into the "தேர்தலை நிறுத்த" popup.
      (f6?.data?.data || []).forEach((form: any) => {
        (form.societies || []).forEach((s: any) => {
          if (s.election_action !== 'STOP') return;
          rows.push({
            district_name: form.district_name || '-',
            zone_name: form.zone_name || '-',
            society_name: s.society_name || '-',
            stage: 'படிவம் 6',
            reason: s.remark || '-'
          });
        });
      });

      // Form8's own stopped-society list is derived entirely from Form7's
      // form7_societies rows (polling_suspension_count / stop_reason), so
      // it's the same data as the Form7 block above — not pulled again here.

      this.rows = rows;
    });
  }

  downloadPdf(): void {

    const departmentId = 2;

    this.userService.getForm8StoppedPdf(departmentId).subscribe(
      (res: Blob) => {

        saveAs(
          new Blob([res], { type: 'application/pdf' }),
          'Stopped_Societies_Report.pdf'
        );

      },
      error => {
        console.error('PDF download error:', error);
      }
    );
  }
}
