import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserService } from '../../services/user';
import { saveAs } from 'file-saver';

interface CandidateEntry {
  member_name: string;
  aadhar_no: string;
}

// One row per candidate-index within a society (row 1 shows candidate #1
// in each category, row 2 shows candidate #2, etc.) — society name and the
// required-counts columns only render on the first row of that society
// (rowSpan); district/zone is one value for the whole response, so it only
// renders on the table's very first row, spanning every row.
interface TableRow {
  serial: number;
  society_name: string;

  sc_total: number;
  women_total: number;
  general_total: number;
  grand_total: number;

  sc: CandidateEntry | null;
  women: CandidateEntry | null;
  general: CandidateEntry | null;

  districtName: string;
  zoneName: string;

  rowSpan?: number;
  districtZoneRowSpan?: number;
}

@Component({
  selector: 'app-formt5',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formt5.html',
  styleUrls: ['./formt5.css']
})
export class Formt5 implements OnInit {

  tableRows: TableRow[] = [];
  department_name = '';

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadForm5();
  }

  loadForm5(): void {
    this.userService.getForm5Table().subscribe({
      next: (res) => {

        console.log("FORM5 RESPONSE:", res);

        const apiData = res?.data;

        if (res?.success && apiData) {

          this.department_name = apiData.department_name;

          this.prepareRows(apiData);

        } else {
          this.tableRows = [];
        }

      },
      error: err => console.error("FORM5 API ERROR:", err)
    });
  }

  private prepareRows(data: any): void {

    const districtGroups = data.data || [];

    const rows: TableRow[] = [];
    let serial = 0;

    districtGroups.forEach((districtGroup: any) => {

      const districtName = districtGroup.district_name || '';
      const zoneName = districtGroup.zone_name || '';
      const members = districtGroup.members || [];

      const societyMap = new Map<string, {
        society_name: string;
        sc: CandidateEntry[];
        women: CandidateEntry[];
        general: CandidateEntry[];
      }>();

      members.forEach((m: any) => {

        if (!societyMap.has(m.society_name)) {
          societyMap.set(m.society_name, {
            society_name: m.society_name,
            sc: [],
            women: [],
            general: []
          });
        }

        const group = societyMap.get(m.society_name)!;
        const entry: CandidateEntry = {
          member_name: m.member_name,
          aadhar_no: m.aadhar_no
        };

        if (m.category_type === 'sc_st') group.sc.push(entry);
        else if (m.category_type === 'women') group.women.push(entry);
        else if (m.category_type === 'general') group.general.push(entry);
      });

      const groupStart = rows.length;

      societyMap.forEach(group => {

        const maxRows = Math.max(group.sc.length, group.women.length, group.general.length, 1);

        serial += 1;

        for (let i = 0; i < maxRows; i++) {

          rows.push({
            serial,
            society_name: i === 0 ? group.society_name : '',

            sc_total: group.sc.length,
            women_total: group.women.length,
            general_total: group.general.length,
            grand_total: group.sc.length + group.women.length + group.general.length,

            sc: group.sc[i] || null,
            women: group.women[i] || null,
            general: group.general[i] || null,

            districtName,
            zoneName,

            rowSpan: i === 0 ? maxRows : undefined
          });
        }
      });

      if (rows.length > groupStart) {
        rows[groupStart].districtZoneRowSpan = rows.length - groupStart;
      }
    });

    this.tableRows = rows;
  }

  downloadPdf(): void {

    const departmentId = 2;

    this.userService.getForm5Pdf(departmentId).subscribe(
      (res: Blob) => {

        saveAs(
          new Blob([res], { type: 'application/pdf' }),
          'Form5a_Report.pdf'
        );

      },
      error => {
        console.error('PDF download error:', error);
      }
    );
  }

}
