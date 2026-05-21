/**
 * Maps a lookup key to its admin management URL.
 * Used by LookupPickerField and ModalSelectField to show the ⚙️ settings button.
 */
export const LOOKUP_ADMIN_HREF: Record<string, string> = {
  gender:            "/admin/lookups/gender",
  marital_status:    "/admin/lookups/marital_status",
  employment_type:   "/admin/lookups/employment_type",
  employment_status: "/admin/lookups/employment_status",
  salary_type:       "/admin/lookups/salary_type",
  pay_cycle:         "/admin/lookups/pay_cycle",
  payment_method:    "/admin/lookups/payment_method",
};

export const LOOKUP_ORG_HREF: Record<string, string> = {
  gender:            "/org/lookups/gender",
  marital_status:    "/org/lookups/marital_status",
  employment_type:   "/org/lookups/employment_type",
  employment_status: "/org/lookups/employment_status",
  salary_type:       "/org/lookups/salary_type",
  pay_cycle:         "/org/lookups/pay_cycle",
  payment_method:    "/org/lookups/payment_method",
};
