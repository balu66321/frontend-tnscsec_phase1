import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { UserService } from '../../services/user';
import { RouterModule } from "@angular/router";

/* =========================
   INTERFACES
========================= */

interface SelectedSociety {
  society_id: number;
  society_name: string;
  sc_st: number;
  women: number;
  general: number;
  tot_voters: number;
}

interface MasterzoneSociety {
  society_id: number;
  society_name: string;
}

interface Form1ApiRow {
  id: number;
  department_name: string;
  district_name: string;
  zone_name: string;
  masterzone_count: number;
  remark: string;
  selected_count: number;
  non_selected_count: number;
  selected_soc: SelectedSociety[];
  masterzone_societies: MasterzoneSociety[];
}

interface TableRow {
  id: number;
  department_name: string;
  district_name: string;
  zone_name: string;
  masterzone_count: number;
  society_name: string;

  sc_st: number | null;
  women: number | null;
  general: number | null;
  tot_voters: number | null;

  isSelected: boolean;
  remark: string;

  // Group-level values, set only on the first row of each district/zone group
  // (rowSpan rows), so the cells can span the whole group.
  rowSpan?: number;
  selected_count?: number;

  // Per-row reason this specific society did not get its election notice
  // (one of Form1's reasonOptions values), or null for a selected society.
  reason: string | null;

  // Non-selected count repeated on every row of the group
  group_non_selected_count: number;
}

/* =========================
   COMPONENT
========================= */

@Component({
  selector: 'app-formt1',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './formt1.html',
  styleUrls: ['./formt1.css']
})
export class Formt1 implements OnInit {

  tableRows: TableRow[] = [];
  department_name = '';   // Header use (optional)

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadForm1Table();
  }

  /* =========================
     LOAD API DATA
  ========================= */
  loadForm1Table(): void {
    this.userService.getForm1Table().subscribe((res: any) => {

      // ✅ Correct path: res.data.data
      const apiData = res?.data?.data;

      if (res?.success && Array.isArray(apiData)) {

        // Header
        if (apiData.length > 0) {
          this.department_name = apiData[0].department_name;
        }

        this.prepareRows(apiData as Form1ApiRow[]);
      } else {
        this.tableRows = [];
      }

    });
  }

  /* =========================
     TRANSFORM API → TABLE
  ========================= */
  private prepareRows(data: any[]): void {
    this.tableRows = [];

    data.forEach((row: any) => {

      // Combine selected + non-selected societies
      const allSocieties = [
        ...(row.selected_soc || []),
        ...(row.non_selected_soc || [])
      ];

      const selectedIds = new Set(
        (row.selected_soc || []).map((s: any) => s.society_id)
      );

      const totalRows = allSocieties.length;

      allSocieties.forEach((soc: any, index: number) => {

        const isSelected = selectedIds.has(soc.society_id);
        const isFirst = index === 0;

        this.tableRows.push({
          id: row.id,
          department_name: row.department_name,
          district_name: row.district_name,
          zone_name: row.zone_name,
          masterzone_count: row.selected_count + row.non_selected_count,
          society_name: soc.society_name,

          sc_st: isSelected ? soc.sc_st : null,
          women: isSelected ? soc.women : null,
          general: isSelected ? soc.general : null,
          tot_voters: isSelected ? soc.tot_voters : null,

          isSelected: isSelected,
          remark: row.remark,

          rowSpan: isFirst ? totalRows : undefined,
          selected_count: isFirst ? row.selected_count : undefined,
          reason: isSelected ? null : (soc.reason || null),

          group_non_selected_count: row.non_selected_count
        });

      });

    });
  }
  /* =========================
     EXPORT EXCEL
  ========================= */
  downloadPdf(): void {

    const departmentId = 2; // dynamic if needed

    this.userService.getForm1Pdf(departmentId).subscribe({

      next: (res: Blob) => {

        const blob = new Blob([res], {
          type: 'application/pdf'
        });

        saveAs(blob, 'Form1_Report.pdf');

      },

      error: (error) => {
        console.error('PDF download error:', error);
      }

    });

  }
  /* =========================
     DUMMY EDIT
  ========================= */
  onEdit(): void {
    alert('Edit clicked');
  }
}
