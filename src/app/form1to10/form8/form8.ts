import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../services/user';
import { Router } from '@angular/router';

@Component({
    selector: 'app-form8',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './form8.html',
    styleUrls: ['./form8.css']
})
export class Form8 implements OnInit {

    district_name = '';
    Zone_name = '';

    countingSocieties: any[] = [];


    isEditMode = false;
    editableData: any = null;
    form8_id!: number;
    selectedSociety: any = null;
    readonly memberCategories = [
        { key: 'SC_ST', label: 'ப.தி./ப.கு' },
        { key: 'WOMEN', label: 'மகளிர்' },
        { key: 'GENERAL', label: 'பொது' }
    ];
    showPreviewPopup: boolean = false;
showMembersPopup = false;    memberSections: { title: string; rows: { society_name: string; sc: string; women: string; general: string }[] }[] = [];


    constructor(private userService: UserService, private router: Router) { }

    ngOnInit(): void {

        this.district_name = localStorage.getItem('district_name') || '';
        this.Zone_name = localStorage.getItem('zone_name') || '';

        this.loadEditableForm8();

    }

    loadEditableForm8() {

        this.userService.getEditableForm8().subscribe({

            next: (res: any) => {

                this.editableData = res.data;

                // this.isEditMode = res.data.societies?.length > 0;

                // if (res.data.form8_id) {
                //     this.form8_id = res.data.form8_id;
                // }


                this.isEditMode = (res.data.pollingDetails?.length || 0) > 0;

                if (res.data.form8?.id) {
                    this.form8_id = res.data.form8.id;
                }
                console.log('EDIT MODE', this.isEditMode);
                console.log('EDIT DATA', this.editableData);

                this.loadPreview();

            },

            error: () => {

                this.isEditMode = false;

                this.loadPreview();

            }

        });

    }

    /* ================= LOAD PREVIEW ================= */
    loadPreview() {

        this.userService.getForm8Preview().subscribe((res: any) => {

            if (!res?.success) return;

            const data = res.data;


            /* ===== F4 – NO ISSUES societies ===== */
            /* ===== F4 – NO ISSUES societies ===== */

            const polled = data.polled_societies || [];

            this.countingSocieties = polled
                .filter((s: any) => s.polling_suspension_count === 'NO_ISSUES')
                .map((s: any) => {

                    const polling = this.editableData?.pollingDetails?.find(
                        (x: any) => x.form7_society_id === s.form7_society_id
                    );

                    const winners = this.editableData?.finalResults
                        ?.filter((x: any) => x.form7_society_id === s.form7_society_id)
                        .map((x: any) => ({
                            form5_member_id: x.form5_member_id,
                            category_type: x.category_type
                        })) || [];

                    const savedVotes = this.editableData?.candidateVotes?.filter(
                        (v: any) => v.form7_society_id === s.form7_society_id
                    ) || [];

                    const membersWithVotes = Object.fromEntries(
                        Object.entries(s.members ?? {}).map(([cat, list]: any) => [
                            cat,
                            list.map((m: any) => ({
                                ...m,
                                votes_obtained:
                                    savedVotes.find((v: any) => v.form5_member_id === m.form5_member_id)?.votes_obtained ?? 0
                            }))
                        ])
                    );

                    return {

                        ...s,

                        members: membersWithVotes,

                        rural: {
                            sc_st: s.rural?.sc_st || 0,
                            women: s.rural?.women || 0,
                            general: s.rural?.general || 0
                        },

                        ballot_box_votes:
                            polling?.ballot_votes_at_counting ?? 0,

                        valid_votes:
                            polling?.valid_votes ?? 0,

                        invalid_votes:
                            polling?.invalid_votes ?? 0,

                        remarks:
                            polling?.remarks ?? '',

                        selectedMembers: winners,

                        submitted: winners.length > 0

                    };

                });
            /* ===== EDITABLE DATA ===== */

        }
        )
    }
    /* ================= POPUP ================= */
    openPreviewPopup(row: any) {
        this.selectedSociety = row;

        if (!this.selectedSociety.selectedMembers) {
            this.selectedSociety.selectedMembers = [];
        }

        this.showPreviewPopup = true;
    }

    closePreview() {
        this.showPreviewPopup = false;
        this.selectedSociety = null;
    }

    getMembers(category: string) {
        if (!this.selectedSociety || !this.selectedSociety.members) return [];
        return this.selectedSociety.members[category] || [];
    }

    /* ================= MEMBER SELECT ================= */
    onMemberToggle(member: any, category: string, event: any) {

        if (!this.selectedSociety.selectedMembers) {
            this.selectedSociety.selectedMembers = [];
        }

        if (event.target.checked) {
            this.selectedSociety.selectedMembers.push({

                form5_member_id: member.form5_member_id,
                member_name: member.member_name,
                vote_count: member.vote_count || 0,
                category_type: category

            });
        } else {
            this.selectedSociety.selectedMembers =
                this.selectedSociety.selectedMembers.filter(
                    (m: any) => m.form5_member_id !== member.form5_member_id
                );
        }
    }

    calculateInvalidVotes(s: any) {

        const ballot = Number(s.ballot_box_votes) || 0;
        const valid = Number(s.valid_votes) || 0;

        // Validation: valid cannot exceed ballot
        if (valid > ballot) {
            alert('செல்லுபடியான வாக்குகள் மொத்த வாக்குகளை விட அதிகமாக இருக்க முடியாது');
            s.valid_votes = ballot;
        }

        // Auto calculate invalid
        s.invalid_votes = ballot - s.valid_votes;

        // Prevent negative
        if (s.invalid_votes < 0) {
            s.invalid_votes = 0;
        }
    }

    /* ================= SAVE WINNERS (Popup Submit) ================= */
    submitPreview() {

        const totalEntered = this.memberCategories
            .flatMap(cat => this.getMembers(cat.key))
            .reduce((sum: number, m: any) => sum + (Number(m.votes_obtained) || 0), 0);

        const validVotes = Number(this.selectedSociety.valid_votes) || 0;

        if (totalEntered !== validVotes) {
            alert(
                `பெற்ற வாக்குகளின் கூடுதல் (${totalEntered}) செல்லுபடியான வாக்குகளின் எண்ணிக்கைக்கு (${validVotes}) சமமாக இல்லை`
            );
            return;
        }

        // const selected = this.selectedSociety.selectedMembers;

        // if (!selected || selected.length === 0) {
        //     alert('உறுப்பினரை தேர்வு செய்யவும்');
        //     return;
        // }

        // Count category
        // const count = { SC_ST: 0, WOMEN: 0, GENERAL: 0 };

        // selected.forEach((m: any) => {
        //     if (m.category_type === 'SC_ST') count.SC_ST++;
        //     if (m.category_type === 'WOMEN') count.WOMEN++;
        //     if (m.category_type === 'GENERAL') count.GENERAL++;
        // });

        // const limit = this.selectedSociety.rural;

        // // Validation
        // if (
        //     count.SC_ST !== limit.sc_st ||
        //     count.WOMEN !== limit.women ||
        //     count.GENERAL !== limit.general
        // ) {
        //     alert(
        //         `தேர்வு எண்ணிக்கை தவறு!\n` +
        //         `SC/ST: ${limit.sc_st}\n` +
        //         `மகளிர்: ${limit.women}\n` +
        //         `பொது: ${limit.general}`
        //     );
        //     return;
        // }

        const soc = this.selectedSociety;

        const payload = {
            societies: [{
                form7_society_id: soc.form7_society_id,
                candidates: this.buildCandidates(soc)
            }]
        };

        this.userService.saveForm8Checkbox(payload).subscribe({
            next: (res: any) => {
                const list = Array.isArray(res) ? res : (res?.data ?? []);
                const result = list[0];

                soc.selectedMembers = (['SC_ST', 'WOMEN', 'GENERAL'] as const).flatMap(cat =>
                    (result?.winners?.[cat] ?? []).map((w: any) => ({
                        form5_member_id: w.form5_member_id,
                        category_type: cat
                    }))
                );

                soc.submitted = true;
                this.closePreview();
                alert('வெற்றிகரமாக சேமிக்கப்பட்டது');
            },
            error: (err: any) => {
                alert(err?.error?.message || 'சேமிக்க முடியவில்லை');
            }
        });
    }

    buildCandidates(soc: any) {
        return (['SC_ST', 'WOMEN', 'GENERAL'] as const).flatMap(cat =>
            (soc.members?.[cat] ?? []).map((m: any) => ({
                form5_member_id: m.form5_member_id,
                category_type: cat,
                votes_obtained: Number(m.votes_obtained) || 0
            }))
        );
    }

    /* ================= FINAL SUBMIT (Form8) ================= */
    /* ================= FINAL SUBMIT (Form8) ================= */
    onSubmitForm8() {

        const payload = {

            form8_id: this.form8_id,

            societies: this.countingSocieties.map((s: any) => ({

                form7_society_id: s.form7_society_id,

                polling_details: {

                    ballot_votes_at_counting: s.ballot_box_votes,
                    valid_votes: s.valid_votes,
                    invalid_votes: s.invalid_votes,
                    remarks: s.remarks

                },

                candidates: this.buildCandidates(s)

            }))

        };

        console.log(this.isEditMode ? 'EDIT PAYLOAD' : 'SUBMIT PAYLOAD', payload);

        if (this.isEditMode) {

            this.userService.editForm8(payload).subscribe({

                next: () => {

                    alert('Form8 Updated Successfully');
                    this.router.navigate(['/layout/totalforms']);

                },

                error: err => {

                    console.log(err);

                }

            });

        } else {

            this.userService.submitForm8(payload).subscribe({

                next: () => {

                    alert('Form8 Submitted Successfully');
                    this.router.navigate(['/layout/totalforms']);

                },

                error: err => {

                    console.log(err);

                }

            });

        }

    }
    /* ================= CANCEL ================= */
    onCancel() {
        window.history.back();
    }

}
