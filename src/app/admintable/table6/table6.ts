import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { saveAs } from 'file-saver';
import { UserService } from '../../services/user';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// One row per candidate-index... no — one row per society (district/zone
// merge across every society row belonging to that form, via rowSpan; an
// unfiltered "All districts" admin view can contain several forms, so
// district/zone are per-row, not a single value for the whole table).
interface TableRow {
  district_name: string;
  zone_name: string;

  society_name: string;
  dec_sc_names: string;
  dec_women_names: string;
  dec_general_names: string;
  dec_total: number;

  count_society_name: string;
  count_sc: number;
  count_women: number;
  count_general: number;
  count_total: number;

  w_society_name: string;
  w_sc: number;
  w_women: number;
  w_general: number;
  w_total: number;

  eq_society_name: string;
  eq_sc: number;
  eq_women: number;
  eq_general: number;
  eq_total: number;

  less_society_name: string;
  less_sc: number;
  less_women: number;
  less_general: number;
  less_total: number;

  declared_society_name: string;
  declared_sc: number;
  declared_women: number;
  declared_general: number;
  declared_total: number;

  final_society_name: string;
  final_sc: number;
  final_women: number;
  final_general: number;
  final_total: number;

  stopped_society_name: string;
  stop_reason_display: string;

  rowSpan?: number;
}

// District/zone-wise summary — societies counted by their election
// outcome (qualified for polling / unopposed / unqualified), matching the
// groups shown in the Full List.
interface AbstractRow {
  district_name: string;
  zone_name: string;
  society_count: number;
  qualified_count: number;
  unopposed_count: number;
  unqualified_count: number;
}

@Component({
  selector: 'app-table6',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './table6.html',
  styleUrls: ['./table6.css']
})
export class Table6 implements OnInit {

  department_name = '';
  tableRows: TableRow[] = [];
  abstractRows: AbstractRow[] = [];
  viewMode: 'full' | 'abstract' = 'full';

  grandTotal: AbstractRow = {
    district_name: '',
    zone_name: '',
    society_count: 0,
    qualified_count: 0,
    unopposed_count: 0,
    unqualified_count: 0
  };

  selectedDepartment = '';
  selectedDistrict = '';

  departmentList: { id: number; name: string }[] = [];
  districtList: { id: number; name: string }[] = [];

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadDepartments();
    this.loadDistricts();
    this.loadForm6();
  }

  private prepareRows(apiData: any): void {

    const forms = apiData.data || [];

    const rows: TableRow[] = [];
    const abstractGroups = new Map<string, {
      district_name: string;
      zone_name: string;
      societyNames: Set<string>;
      qualified: number;
      unopposed: number;
      unqualified: number;
    }>();

    forms.forEach((item: any) => {

      const district = item.district_name || '-';
      const zone = item.zone_name || '-';
      const societies = item.societies || [];

      const groupStartIndex = rows.length;

      societies.forEach((soc: any) => {

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

          // NOTE: backend doesn't yet track a structured stop reason for
          // Form6 — these stay '-' until that's added, matching Form5B's
          // stop_reason field.
          stopped_society_name: '-',
          stop_reason_display: '-',

          rowSpan: undefined
        });

        const abstractKey = `${district}||${zone}`;
        if (!abstractGroups.has(abstractKey)) {
          abstractGroups.set(abstractKey, {
            district_name: district,
            zone_name: zone,
            societyNames: new Set<string>(),
            qualified: 0,
            unopposed: 0,
            unqualified: 0
          });
        }
        const ag = abstractGroups.get(abstractKey)!;
        ag.societyNames.add(soc.society_name || '-');
        if (isQualified) ag.qualified += 1;
        else if (isUnopposed) ag.unopposed += 1;
        else if (isUnqualified) ag.unqualified += 1;

      });

      if (rows.length > groupStartIndex) {
        rows[groupStartIndex].rowSpan = rows.length - groupStartIndex;
      }

    });

    this.tableRows = rows;

    this.abstractRows = Array.from(abstractGroups.values()).map(g => ({
      district_name: g.district_name,
      zone_name: g.zone_name,
      society_count: g.societyNames.size,
      qualified_count: g.qualified,
      unopposed_count: g.unopposed,
      unqualified_count: g.unqualified
    }));

    this.computeGrandTotal();

  }

  private computeGrandTotal(): void {

    const totals: AbstractRow = {
      district_name: '',
      zone_name: '',
      society_count: 0,
      qualified_count: 0,
      unopposed_count: 0,
      unqualified_count: 0
    };

    this.abstractRows.forEach(a => {
      totals.society_count += a.society_count;
      totals.qualified_count += a.qualified_count;
      totals.unopposed_count += a.unopposed_count;
      totals.unqualified_count += a.unqualified_count;
    });

    this.grandTotal = totals;

  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'full' ? 'abstract' : 'full';
  }

  loadDepartments(): void {

    this.userService.getdepartment().subscribe((res: any) => {

      if (res?.success) {

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

      if (res?.success) {

        this.districtList = res.data
          .filter((d: any) => d.is_active === 1)
          .map((d: any) => ({
            id: d.id,
            name: d.name.trim()
          }));

      }

    });

  }

  applyFilter(): void {

    const deptId = this.departmentList.find(
      d => d.name === this.selectedDepartment
    )?.id;

    const distId = this.districtList.find(
      d => d.name === this.selectedDistrict
    )?.id;

    this.userService.loadForm6Filtered(deptId, distId)
      .subscribe({

        next: (res: any) => {

          const apiData = res?.data;

          if (!res?.success || !apiData) {
            this.tableRows = [];
            this.abstractRows = [];
            this.computeGrandTotal();
            return;
          }

          this.department_name = apiData.department_name || '';

          this.prepareRows(apiData);

        },

        error: err => console.error(err)

      });

  }

  loadForm6(): void {

    this.userService.getForm6Table().subscribe({

      next: (res: any) => {

        if (!res.success) {
          this.tableRows = [];
          this.abstractRows = [];
          this.computeGrandTotal();
          return;
        }

        this.department_name = res.data?.data?.[0]?.department_name || '';

        this.prepareRows(res.data);

      }

    });

  }

  downloadPdf(): void {

    const deptId = this.departmentList.find(
      d => d.name === this.selectedDepartment
    )?.id;

    const distId = this.districtList.find(
      d => d.name === this.selectedDistrict
    )?.id;

    if (this.viewMode === 'abstract') {
      this.userService.getForm6AbstractPdf(deptId, distId).subscribe({
        next: (res: Blob) => {
          saveAs(new Blob([res], { type: 'application/pdf' }), 'Form6_Abstract_Report.pdf');
        },
        error: err => console.error('Abstract PDF download error:', err)
      });
      return;
    }

    this.userService.getForm6Pdf(deptId, distId)
      .subscribe({

        next: (res: Blob) => {

          saveAs(
            new Blob([res], { type: 'application/pdf' }),
            'Form6_Report.pdf'
          );

        },

        error: err => console.error(err)

      });

  }
}
