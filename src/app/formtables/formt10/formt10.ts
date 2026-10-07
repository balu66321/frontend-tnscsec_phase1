import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { UserService } from '../../services/user';

@Component({
  selector: 'app-formt10',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './formt10.html',
  styleUrls: ['./formt10.css']
})
export class Formt10 implements OnInit {

  department_name = '';
  tableRows: any[] = [];

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.loadForm10();
  }

  private maskAadhar(aadhar: string): string {
    return aadhar ? 'xxxx xxxx ' + aadhar.slice(-4) : '';
  }

  // Joins a list of candidates into "NAME - xxxx xxxx 1234, NAME - ..."
  // — built from the candidate objects directly since the backend's
  // plain "*_member_names" string doesn't carry the Aadhaar number.
  private namesWithAadhar(candidates: any[]): string {
    return (candidates || [])
      .map((c: any) => c.member_name
        ? `${c.member_name} - ${this.maskAadhar(c.aadhar_no)}`
        : null)
      .filter(Boolean)
      .join(',   ') || '-';
  }

  private resolveElectionType(soc: any): string {
    return soc.table7_vice_president?.election_type || soc.election_type || '-';
  }

  loadForm10(): void {

    this.userService.getForm10List().subscribe(res => {

      if (!res?.success || !res.data?.length) return;

      const rows: any[] = [];
      const addedSocieties = new Set<number>();

      res.data.forEach((form: any) => {

        const department = form.department?.name || '';
        const district = form.district?.name || '';
        const zone = form.zone?.name || '';

        this.department_name = department;

        // District/zone merge across every society row belonging to this
        // form — dedup above can skip societies, so the actual row count
        // per form is only known after the loop, not from societies.length.
        const startIndex = rows.length;

        form.societies?.forEach((soc: any) => {

          if (addedSocieties.has(soc.society_id)) {
            return;
          }

          addedSocieties.add(soc.society_id);

          rows.push({
            district_name: district,
            zone_name: zone,
            society_name: soc.society_name || '-',

            // Filed candidate names (with masked Aadhaar)
            filed_names: this.namesWithAadhar(soc.filed_members?.all || soc.table1_candidates || soc.candidates),

            // Rejected candidate names (with masked Aadhaar)
            rejected_names: this.namesWithAadhar(soc.rejected_members?.all || soc.table3_candidates),

            // Withdrawn candidate names (with masked Aadhaar)
            withdrawn_names: this.namesWithAadhar(soc.withdrawn_members?.all || soc.table5_candidates),

            // Final eligible candidate names (with masked Aadhaar)
            eligible_names: this.namesWithAadhar(soc.eligible_members?.all || soc.table6_candidates),

            // Election method
            election_type: this.resolveElectionType(soc)
          });
        });

        if (rows.length > startIndex) {
          (rows[startIndex] as any).rowSpan = rows.length - startIndex;
        }
      });

      this.tableRows = rows;
    });
  }


  downloadPdf(): void {

    const departmentId = 2;

    this.userService.getForm10Pdf(departmentId).subscribe(
      (res: Blob) => {

        saveAs(
          new Blob([res], { type: 'application/pdf' }),
          'Form10_Report.pdf'
        );

      },
      error => {
        console.error('PDF download error:', error);
      }
    );
  }
}
