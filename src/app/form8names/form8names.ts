import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { saveAs } from 'file-saver';
import { UserService } from '../services/user';

interface Names {
  sc: string;
  women: string;
  general: string;
}

interface NameRow {
  society_name: string;
  unopposed: Names | null;
  aboveHalfQuorum: Names | null;
  winners: Names | null;
}

@Component({
  selector: 'app-form8names',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './form8names.html',
  styleUrls: ['./form8names.css']
})
export class Form8Names implements OnInit {

  rows: NameRow[] = [];
  department_name = '';
  district_name = '';
  zone_name = '';

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.district_name = localStorage.getItem('district_name') || '';
    this.zone_name = localStorage.getItem('zone_name') || '';

    forkJoin({
      f6: this.userService.getForm6Table(),
      f8: this.userService.getForm8Table()
    }).subscribe(({ f6, f8 }) => {
      this.department_name = localStorage.getItem('department_name') || '';
      this.rows = this.buildRows(f6, f8);
    });
  }

  downloadPdf(): void {

    const departmentId = 2;

    this.userService.getForm8NamesPdf(departmentId).subscribe(
      (res: Blob) => {

        saveAs(
          new Blob([res], { type: 'application/pdf' }),
          'Form8_Names_Report.pdf'
        );

      },
      error => {
        console.error('PDF download error:', error);
      }
    );
  }

  private buildRows(f6: any, f8: any): NameRow[] {

    const f6Societies: any[] = f6?.data?.data?.[0]?.societies || [];
    const names = (arr: any): string => (arr || []).join(', ') || '-';

    const byName = new Map<string, NameRow>();
    const rowFor = (name: string): NameRow => {
      if (!byName.has(name)) {
        byName.set(name, { society_name: name, unopposed: null, aboveHalfQuorum: null, winners: null });
      }
      return byName.get(name)!;
    };

    f6Societies.forEach(s => {
      const name = s.society_name || '-';
      const value: Names = {
        sc: names(s.final_scst_names),
        women: names(s.final_women_names),
        general: names(s.final_general_names)
      };

      if (s.election_status === 'UNOPPOSED') {
        rowFor(name).unopposed = value;
      } else if (s.election_status === 'UNQUALIFIED'
        && (s.rural_total || 0) > 0
        && (s.final_total || 0) >= (s.rural_total || 0) * 0.5) {
        rowFor(name).aboveHalfQuorum = value;
      }
    });

    (f8?.data || []).forEach((form: any) => {
      (form.societies || []).forEach((soc: any) => {
        const byCategory = (type: string): string => {
          const cat = (soc.categories || []).find((c: any) => c.category === type);
          return (cat?.winners || []).map((w: any) => w.member_name).join(', ') || '-';
        };
        rowFor(soc.society_name || '-').winners = {
          sc: byCategory('SC_ST'),
          women: byCategory('WOMEN'),
          general: byCategory('GENERAL')
        };
      });
    });

    return Array.from(byName.values());
  }
}
