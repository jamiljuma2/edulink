export type UserRole = 'student' | 'writer' | 'admin';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export const SUBSCRIPTION_PLANS = {
  basic: { price: 5, tasksPerDay: 5 },
  standard: { price: 10, tasksPerDay: 15 },
  premium: { price: 20, tasksPerDay: Infinity },
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PLANS;
