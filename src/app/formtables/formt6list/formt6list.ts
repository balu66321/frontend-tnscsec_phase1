import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { saveAs } from 'file-saver';
import { UserService } from '../../services/user';

// Simpler companion view to formt6 — matches the official reference
// document's 3-group layout exactly (candidate NAMES, not counts, and no
// withdrawn/50%-rule/stopped groups). Same API as formt6 (getForm6Table),
// just rendered differently.
interface TableRow {
  district_name: string;
  zone_name: string;

  // Group 1: final candidate list per final list — always shown
  society_name: string;
  sc_names: string;
  women_names: string;
  general_names: string;
  total: number;
  dec_count: number;

  // Group 2: UNOPPOSED — final candidates = required committee seats
  eq_society_name: string;
  eq_count: number;
  eq_sc_names: string;
  eq_women_names: string;
  eq_general_names: string;
  eq_total: number;

  // Group 3: UNQUALIFIED — final candidates < required committee seats
  less_society_name: string;
  less_count: number;
  less_sc_names: string;
  less_women_names: string;
  less_general_names: string;
  less_total: number;

  rowSpan?: number;
}

@Component({
  selector: 'app-formt6list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formt6list.html',
  styleUrls: ['./formt6list.css']
})
export class Formt6List implements OnInit {

  department_name = '';
  tableRows: TableRow[] = [];

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadForm6();
  }

  loadForm6(): void {
    this.userService.getForm6Table().subscribe({
      next: (res) => {

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

        const eqCount = societies.filter((s: any) => s.election_status === 'UNOPPOSED').length;
        const lessCount = societies.filter((s: any) => s.election_status === 'UNQUALIFIED').length;

        societies.forEach((soc: any, index: number) => {

          const isUnopposed = soc.election_status === 'UNOPPOSED';
          const isUnqualified = soc.election_status === 'UNQUALIFIED';

          const scNames = (soc.final_scst_names || []).join(', ') || '-';
          const womenNames = (soc.final_women_names || []).join(', ') || '-';
          const generalNames = (soc.final_general_names || []).join(', ') || '-';
          const total =
            (soc.final_scst_names?.length || 0) +
            (soc.final_women_names?.length || 0) +
            (soc.final_general_names?.length || 0);

          rows.push({
            district_name: district,
            zone_name: zone,

            society_name: soc.society_name || '-',
            sc_names: scNames,
            women_names: womenNames,
            general_names: generalNames,
            total,
            dec_count: societies.length,

            eq_society_name: isUnopposed ? (soc.society_name || '-') : '-',
            eq_count: eqCount,
            eq_sc_names: isUnopposed ? scNames : '-',
            eq_women_names: isUnopposed ? womenNames : '-',
            eq_general_names: isUnopposed ? generalNames : '-',
            eq_total: isUnopposed ? total : 0,

            less_society_name: isUnqualified ? (soc.society_name || '-') : '-',
            less_count: lessCount,
            less_sc_names: isUnqualified ? scNames : '-',
            less_women_names: isUnqualified ? womenNames : '-',
            less_general_names: isUnqualified ? generalNames : '-',
            less_total: isUnqualified ? total : 0,

            rowSpan: index === 0 ? societies.length : undefined
          });

        });

        this.tableRows = rows;
      },
      error: err => console.error("FORM6 LIST ERROR:", err)
    });
  }

  downloadPdf(): void {

    const departmentId = 2;

    this.userService.getForm6ListPdf(departmentId).subscribe(
      (res: Blob) => {

        saveAs(
          new Blob([res], { type: 'application/pdf' }),
          'Form6_List_Report.pdf'
        );

      },
      error => {
        console.error('PDF download error:', error);
      }
    );
  }
}
