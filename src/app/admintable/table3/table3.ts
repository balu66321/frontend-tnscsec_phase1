import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

interface TableRow {
  district_name: string;
  zone_name: string;

  // Society name lands in exactly one of these two, depending on whether
  // the society gave its own member list or the officer drafted it himself.
  member_society_name: string | null;
  non_member_society_name: string | null;

  member_count: number;
  non_member_count: number;

  ass_memlist: number | null;   // draft voter list count
  ero_claim: string;            // 'ஆம்' | 'இல்லை' | '-'
  jcount: number;               // removed (நீக்கப்பட்ட)
  rcount: number;               // added (சேர்க்கப்பட்ட)
  total: number | null;         // final voter list count

  rowSpan?: number;
  districtSerial?: number;
}

// One row per district+zone group with everything summed —
// no per-society names, counts only.
interface AbstractRow {
  district_name: string;
  zone_name: string;
  societyCount: number;
  memberSocCount: number;
  nonMemberSocCount: number;
  assMemlistTotal: number;
  rcountTotal: number;
  jcountTotal: number;
  finalVotersTotal: number;
}

@Component({
  selector: 'app-formt3',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './table3.html',
  styleUrls: ['./table3.css']
})
export class Table3 implements OnInit {

  tableRows: TableRow[] = [];
  originalRows: TableRow[] = [];
  abstractRows: AbstractRow[] = [];
  viewMode: 'full' | 'abstract' = 'full';

  grandTotal: AbstractRow = {
    district_name: '',
    zone_name: '',
    societyCount: 0,
    memberSocCount: 0,
    nonMemberSocCount: 0,
    assMemlistTotal: 0,
    rcountTotal: 0,
    jcountTotal: 0,
    finalVotersTotal: 0
  };

  department_name = '';

  /* FILTER VALUES */
  selectedDepartment: string = '';
  selectedDistrict: string = '';

  /* MASTER LISTS */
  departmentList: { id: number; name: string }[] = [];
  districtList: { id: number; name: string }[] = [];

  constructor(private userService: UserService) { }

  ngOnInit(): void {

    this.loadForm3();
    this.loadDepartments();
    this.loadDistricts();

  }

  /* =========================
     LOAD MASTER DATA
  ========================= */

  loadDepartments(): void {

    this.userService.getdepartment().subscribe((res: any) => {

      if (res?.success && Array.isArray(res.data)) {

        this.departmentList = res.data
          .filter((d: any) => d.is_active === 1)
          .map((d: any) => ({
            id: d.id,
            name: d.name.trim()
          }));

      }

    });

  }

  loadDistricts(): void {

    this.userService.getdistrict().subscribe((res: any) => {

      if (res?.success && Array.isArray(res.data)) {

        this.districtList = res.data
          .filter((d: any) => d.is_active === 1)
          .map((d: any) => ({
            id: d.id,
            name: d.name.trim()
          }));

      }

    });

  }

  /* =========================
     LOAD TABLE
  ========================= */

  loadForm3(): void {

    this.userService.loadForm3Table().subscribe({

      next: (res: any) => {

        const apiData = res?.data?.data;

        if (res?.success && Array.isArray(apiData) && apiData.length > 0) {

          this.department_name = apiData[0].department_name;

          this.prepareRows(apiData);

          this.originalRows = [...this.tableRows];

        } else {

          this.tableRows = [];

        }

      }

    });

  }

  /* =========================
     TRANSFORM DATA
  ========================= */

  private prepareRows(data: any[]): void {

    const rows: TableRow[] = [];

    let districtSerial = 0;

    data.forEach(item => {

      districtSerial += 1;

      const societies = item.societies || [];

      const span = societies.length;
      const memberCount = societies.filter((s: any) => s.is_member_list === true).length;

      societies.forEach((soc: any, index: number) => {

        const isMember = soc.is_member_list === true;

        rows.push({

          district_name: item.district_name,
          zone_name: item.zone_name,

          member_society_name: isMember ? soc.society_name : null,
          non_member_society_name: isMember ? null : soc.society_name,

          member_count: memberCount,
          non_member_count: span - memberCount,

          ass_memlist: soc.ass_memlist ?? null,

          ero_claim:
            soc.ero_claim === 1 ? 'ஆம்'
              : soc.ero_claim === 0 ? 'இல்லை'
                : '-',

          jcount: soc.jcount ?? 0,
          rcount: soc.rcount ?? 0,

          total: soc.total ?? null,

          rowSpan: index === 0 ? span : undefined,
          districtSerial: index === 0 ? districtSerial : undefined

        });

      });

    });

    this.tableRows = rows;

    this.buildAbstractRows();

  }

  /* =========================
     ABSTRACT (DISTRICT/ZONE-WISE SUMMARY)
  ========================= */
  private buildAbstractRows(): void {

    const groups = new Map<string, AbstractRow>();

    this.tableRows.forEach(r => {

      const key = `${r.district_name}||${r.zone_name}`;

      if (!groups.has(key)) {
        groups.set(key, {
          district_name: r.district_name,
          zone_name: r.zone_name,
          societyCount: 0,
          memberSocCount: 0,
          nonMemberSocCount: 0,
          assMemlistTotal: 0,
          rcountTotal: 0,
          jcountTotal: 0,
          finalVotersTotal: 0
        });
      }

      const g = groups.get(key)!;

      g.societyCount += 1;
      if (r.member_society_name) g.memberSocCount += 1;
      if (r.non_member_society_name) g.nonMemberSocCount += 1;

      g.assMemlistTotal += r.ass_memlist ?? 0;
      g.rcountTotal += r.rcount ?? 0;
      g.jcountTotal += r.jcount ?? 0;
      g.finalVotersTotal += r.total ?? 0;

    });

    this.abstractRows = Array.from(groups.values());

    this.computeGrandTotal();
  }

  // Sum of every district's abstract totals — reflects whatever
  // Department/District filter produced the current tableRows.
  private computeGrandTotal(): void {

    const totals: AbstractRow = {
      district_name: '',
      zone_name: '',
      societyCount: 0,
      memberSocCount: 0,
      nonMemberSocCount: 0,
      assMemlistTotal: 0,
      rcountTotal: 0,
      jcountTotal: 0,
      finalVotersTotal: 0
    };

    this.abstractRows.forEach(g => {
      totals.societyCount += g.societyCount;
      totals.memberSocCount += g.memberSocCount;
      totals.nonMemberSocCount += g.nonMemberSocCount;
      totals.assMemlistTotal += g.assMemlistTotal;
      totals.rcountTotal += g.rcountTotal;
      totals.jcountTotal += g.jcountTotal;
      totals.finalVotersTotal += g.finalVotersTotal;
    });

    this.grandTotal = totals;
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'full' ? 'abstract' : 'full';
  }

  /* =========================
     APPLY FILTER
  ========================= */

  applyFilter(): void {

    const deptId = this.departmentList
      .find(d => d.name === this.selectedDepartment)?.id;

    const distId = this.districtList
      .find(d => d.name === this.selectedDistrict)?.id;

    this.userService.loadForm3Filtered(deptId, distId)
      .subscribe((res: any) => {

        const apiData = res?.data?.data;

        if (Array.isArray(apiData) && apiData.length > 0) {

          this.prepareRows(apiData);
          this.originalRows = [...this.tableRows];

        } else {

          this.tableRows = [];
          this.originalRows = [];
          this.abstractRows = [];
          this.computeGrandTotal();

        }

      });

  }

  /* =========================
     CLEAR FILTER
  ========================= */

  clearFilter(): void {

    this.selectedDepartment = '';
    this.selectedDistrict = '';

    this.loadForm3();

  }

  /* =========================
     EXPORT EXCEL
  ========================= */

  //   exportToExcel(): void {

  //     const table = document.getElementById('reportTable');
  //     if (!table) return;

  //     const worksheet = XLSX.utils.table_to_sheet(table);

  //     const workbook = {
  //       Sheets: { Report: worksheet },
  //       SheetNames: ['Report']
  //     };

  //     const buffer = XLSX.write(workbook, {
  //       bookType: 'xlsx',
  //       type: 'array'
  //     });

  //     saveAs(new Blob([buffer]), 'Form3_Report.xlsx');

  //   }

  // }


  downloadPdf(): void {

    const departmentId = this.departmentList.find(
      d => d.name === this.selectedDepartment
    )?.id;

    const districtId = this.districtList.find(
      d => d.name === this.selectedDistrict
    )?.id;

    if (this.viewMode === 'abstract') {

      this.userService.getForm3AbstractPdf(departmentId, districtId).subscribe(
        (res: Blob) => {
          saveAs(
            new Blob([res], { type: 'application/pdf' }),
            'Form3_Abstract_Report.pdf'
          );
        },
        error => {
          console.error('Abstract PDF download error:', error);
        }
      );
      return;
    }

    this.userService.getForm3Pdf(departmentId, districtId).subscribe(
      (res: Blob) => {

        saveAs(
          new Blob([res], { type: 'application/pdf' }),
          'Form3_Report.pdf'
        );

      },
      error => {
        console.error('PDF download error:', error);
      }
    );

  }
}