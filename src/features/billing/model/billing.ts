export interface BillingStatus {
  plan: "free" | "pro";
  subscription_status: string | null;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  has_billing_account: boolean;
  owned_boards: number;
  max_owned_boards: number | null;
  max_invited_people_per_board: number;
}
