import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user';
import { saveAs } from 'file-saver';

interface TableRow {
  district_name: string;
  zone_name: string;

  // Group: final candidate list, per society (always shown) — shows the
  // actual candidate NAMES per category, not just a count, since
  // "இறுதி பட்டியலின்படி" refers to Form6's own final candidate list.
  society_name: string;
  dec_sc_names: string;
  dec_women_names: string;
  dec_general_names: string;
  dec_total: number;

  // Group: count of the final candidate list above (same society, just
  // the numeric count of each category instead of the names)
  count_society_name: string;
  count_sc: number;
  count_women: number;
  count_general: number;
  count_total: number;

  // Group: withdrawn (only when > 0)
  w_society_name: string;
  w_sc: number;
  w_women: number;
  w_general: number;
  w_total: number;

  // Group: UNOPPOSED (equal — no contest)
  eq_society_name: string;
  eq_sc: number;
  eq_women: number;
  eq_general: number;
  eq_total: number;

  // Group: UNQUALIFIED (less than required)
  less_society_name: string;
  less_sc: number;
  less_women: number;
  less_general: number;
  less_total: number;

  // Group: declared elected unopposed — UNOPPOSED societies, PLUS an
  // UNQUALIFIED society whose final candidate count is still >= 50% of the
  // required (rural) committee seats (partial committee declared unopposed
  // rather than going to a contested Form9 election).
  declared_society_name: string;
  declared_sc: number;
  declared_women: number;
  declared_general: number;
  declared_total: number;

  // Group: QUALIFIED — goes to polling
  final_society_name: string;
  final_sc: number;
  final_women: number;
  final_general: number;
  final_total: number;

  // Group: election stopped — name + reason
  // NOTE: backend doesn't yet track a structured stop reason for Form6
  // (only a free-text remark, and it folds into UNQUALIFIED status without
  // a way to tell "stopped" apart from "naturally short of candidates") —
  // these stay '-' until that's added, matching Form5B's stop_reason field.
  stopped_society_name: string;
  stop_reason_display: string;

  rowSpan?: number;
}

@Component({
  selector: 'app-formt6',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formt6.html',
  styleUrls: ['./formt6.css']
})
export class Formt6 implements OnInit {

  department_name = '';
  tableRows: TableRow[] = [];

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadForm6();
  }

  loadForm6(): void {
    this.userService.getForm6Table().subscribe({
      next: (res) => {

        console.log("FORM6 RESPONSE:", res);

        const apiData = res?.data?.data;

        if (!res?.success || !Array.isArray(apiData) || apiData.length === 0) {
          this.tableRows = [];
          return;
        }

        const main = apiData[0];

        this.department_name = main.department_name || '';

        const district = main.district_name || '';
        const zone = main.zone_name || '';

        const societies = main.societies || [];

        const rows: TableRow[] = [];

        const classified = societies.map((soc: any) => this.classify(soc));

        societies.forEach((soc: any, index: number) => {

          const { isQualified, isUnopposed, isUnqualified, isDeclaredUnopposed } = classified[index];

          const wSc = soc.withdrawn_counts?.sc_st || 0;
          const wWomen = soc.withdrawn_counts?.women || 0;
          const wGeneral = soc.withdrawn_counts?.general || 0;
          const wTotal = soc.withdrawn_counts?.total || 0;

          rows.push({
            district_name: district,
            zone_name: zone,

            society_name: soc.society_name || '-',
            dec_sc_names: (soc.final_scst_names || []).join(', ') || '-',
            dec_women_names: (soc.final_women_names || []).join(', ') || '-',
            dec_general_names: (soc.final_general_names || []).join(', ') || '-',
            dec_total:
              (soc.final_scst_names?.length || 0) +
              (soc.final_women_names?.length || 0) +
              (soc.final_general_names?.length || 0),

            count_society_name: soc.society_name || '-',
            count_sc: soc.final_scst_names?.length || 0,
            count_women: soc.final_women_names?.length || 0,
            count_general: soc.final_general_names?.length || 0,
            count_total:
              (soc.final_scst_names?.length || 0) +
              (soc.final_women_names?.length || 0) +
              (soc.final_general_names?.length || 0),

            w_society_name: wTotal > 0 ? (soc.society_name || '-') : '-',
            w_sc: wSc,
            w_women: wWomen,
            w_general: wGeneral,
            w_total: wTotal,

            eq_society_name: isUnopposed ? (soc.society_name || '-') : '-',
            eq_sc: isUnopposed ? (soc.final_sc_st || 0) : 0,
            eq_women: isUnopposed ? (soc.final_women || 0) : 0,
            eq_general: isUnopposed ? (soc.final_general || 0) : 0,
            eq_total: isUnopposed ? (soc.final_total || 0) : 0,

            less_society_name: isUnqualified ? (soc.society_name || '-') : '-',
            less_sc: isUnqualified ? (soc.final_sc_st || 0) : 0,
            less_women: isUnqualified ? (soc.final_women || 0) : 0,
            less_general: isUnqualified ? (soc.final_general || 0) : 0,
            less_total: isUnqualified ? (soc.final_total || 0) : 0,

            declared_society_name: isDeclaredUnopposed ? (soc.society_name || '-') : '-',
            declared_sc: isDeclaredUnopposed ? (soc.final_sc_st || 0) : 0,
            declared_women: isDeclaredUnopposed ? (soc.final_women || 0) : 0,
            declared_general: isDeclaredUnopposed ? (soc.final_general || 0) : 0,
            declared_total: isDeclaredUnopposed ? (soc.final_total || 0) : 0,

            final_society_name: isQualified ? (soc.society_name || '-') : '-',
            final_sc: isQualified ? (soc.final_sc_st || 0) : 0,
            final_women: isQualified ? (soc.final_women || 0) : 0,
            final_general: isQualified ? (soc.final_general || 0) : 0,
            final_total: isQualified ? (soc.final_total || 0) : 0,

            stopped_society_name: '-',
            stop_reason_display: '-',

            // Serial/district/zone merge into one cell spanning every
            // society row — the whole table is a single district/zone.
            rowSpan: index === 0 ? societies.length : undefined
          });

        });
        this.tableRows = rows;

      },
      error: err => console.error("FORM6 ERROR:", err)
    });
  }
  private classify(soc: any) {

    const isQualified = soc.election_status === 'QUALIFIED';
    const isUnopposed = soc.election_status === 'UNOPPOSED';
    const isUnqualified = soc.election_status === 'UNQUALIFIED';

    // Partial-committee rule: an UNQUALIFIED society still counts as
    // "declared elected unopposed" if its final candidates cover at
    // least half of the required (rural) committee seats.
    const requiredTotal = soc.rural_total || 0;
    const meetsPartialThreshold =
      requiredTotal > 0 && (soc.final_total || 0) >= requiredTotal * 0.5;

    const isDeclaredUnopposed =
      isUnopposed || (isUnqualified && meetsPartialThreshold);

    return { isQualified, isUnopposed, isUnqualified, isDeclaredUnopposed };
  }

  downloadPdf(): void {

    const departmentId = 2;

    this.userService.getForm6Pdf(departmentId).subscribe(
      (res: Blob) => {

        saveAs(
          new Blob([res], { type: 'application/pdf' }),
          'Form6_Report.pdf'
        );

      },
      error => {
        console.error('PDF download error:', error);
      }
    );
  }
}
