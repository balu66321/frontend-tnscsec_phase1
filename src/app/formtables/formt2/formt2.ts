import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { UserService } from '../../services/user';
import { RouterModule } from '@angular/router';

/* =========================
   INTERFACES
========================= */

interface Society {
  society_id: number;
  society_name: string;
  voter_list_prepared_count?: number | null;
}

interface Form2ApiRow {
  id: number;
  department_name: string;
  district_name: string;
  zone_name: string;

  masterzone_societies: Society[];
  selected_soc: Society[];
  non_selected_soc: Society[];

  selected_count: number;
  non_selected_count: number;
  remark: string;
}

interface TableRow {
  district_name: string;
  zone_name: string;

  f3_name: string | null;
  f5_name: string | null;
  f6_name: string | null;
  voter_list_prepared_count: number | null;

  selected_count?: number;
  non_selected_count?: number;
  remark?: string;
  rowSpan?: number;

  f3_count?: number;
  f5_count?: number;
  f6_count?: number;
}



/* =========================
   COMPONENT
========================= */

@Component({
  selector: 'app-formt2',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './formt2.html',
  styleUrls: ['./formt2.css'] // ✅ reuse SAME CSS as Form-T1
})
export class Formt2 implements OnInit {
  department_name: string = '';


  tableRows: TableRow[] = [];

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadForm2Table();
  }

  /* =========================
     LOAD API DATA
  ========================= */
  loadForm2Table(): void {
    this.userService.getForm2Table().subscribe({
      next: (res) => {

        console.log("FULL RESPONSE:", res);

        const apiData = res?.data?.data;   // ✅ FIXED LINE

        if (res?.success && Array.isArray(apiData) && apiData.length > 0) {

          this.department_name = apiData[0].department_name;

          this.prepareRows(apiData as Form2ApiRow[]);
        } else {
          this.tableRows = [];
        }

      },
      error: (err) => {
        console.error('API ERROR:', err);
      }
    });
  }


  /* =========================
     TRANSFORM API → TABLE
  ========================= */
  private prepareRows(data: Form2ApiRow[]): void {
    this.tableRows = [];

    data.forEach(row => {

      // society_id -> whichever count was entered for it (selected or non-selected side)
      const countMap = new Map<number, number | null>();
      row.selected_soc.forEach(s => countMap.set(s.society_id, s.voter_list_prepared_count ?? null));
      row.non_selected_soc.forEach(s => countMap.set(s.society_id, s.voter_list_prepared_count ?? null));

      const f5Ids = new Set(row.selected_soc.map(s => s.society_id));
      const f6Ids = new Set(row.non_selected_soc.map(s => s.society_id));

      const totalRows = row.masterzone_societies.length;

      row.masterzone_societies.forEach((society, index) => {

        this.tableRows.push({
          district_name: row.district_name,
          zone_name: row.zone_name,

          f3_name: society.society_name,
          f5_name: f5Ids.has(society.society_id) ? society.society_name : null,
          f6_name: f6Ids.has(society.society_id) ? society.society_name : null,
          voter_list_prepared_count: countMap.get(society.society_id) ?? null,

          selected_count: index === 0 ? row.selected_count : undefined,
          non_selected_count: index === 0 ? row.non_selected_count : undefined,
          remark: index === 0 ? row.remark : undefined,
          rowSpan: index === 0 ? totalRows : undefined,
          f3_count: row.masterzone_societies.length,
          f5_count: row.selected_soc.length,
          f6_count: row.non_selected_soc.length
        });

      });

    });
  }

  /* =========================
     EXPORT EXCEL
  ========================= */


  downloadPdf(): void {

    const departmentId = 2;

    this.userService.getForm2Pdf(departmentId).subscribe((res: Blob) => {

      saveAs(
        new Blob([res], { type: 'application/pdf' }),
        'Form2_Report.pdf'
      );

    }, error => {

      console.error('PDF download error:', error);

    });

  }
}