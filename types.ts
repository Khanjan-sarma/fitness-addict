export interface Member {
  id: string;
  member_id?: string;
  name: string;
  phone: string;
  join_date: string;
  membership_start: string;
  membership_end: string;
  status?: string;
  goal?: string;
  emergency_contact?: string;
  pt_enquiry?: boolean;
  medical_condition?: string;
  renewal_reminder?: string | null;
  /** Their record id on the door terminal. Null means not enrolled there. */
  hik_person_id?: string | null;
  created_at: string;
}

export type MembershipStatus = 'Active' | 'Due' | 'Expired';
