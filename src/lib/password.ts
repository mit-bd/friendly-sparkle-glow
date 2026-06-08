/**
 * Strong-password validation + strength scoring, shared by the change-password
 * and any future password flows.
 */

export interface PasswordRule {
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One lowercase letter", test: (pw) => /[a-z]/.test(pw) },
  { label: "One number", test: (pw) => /[0-9]/.test(pw) },
  { label: "One symbol", test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export type PasswordStrength = "weak" | "fair" | "good" | "strong";

export interface PasswordAssessment {
  passed: number;
  total: number;
  /** True only when every rule passes. */
  valid: boolean;
  strength: PasswordStrength;
  /** 0–100 for a progress meter. */
  score: number;
}

export function assessPassword(pw: string): PasswordAssessment {
  const total = PASSWORD_RULES.length;
  const passed = PASSWORD_RULES.filter((r) => r.test(pw)).length;
  const valid = passed === total;
  const score = Math.round((passed / total) * 100);
  const strength: PasswordStrength =
    passed <= 2 ? "weak" : passed === 3 ? "fair" : passed === 4 ? "good" : "strong";
  return { passed, total, valid, strength, score };
}

export const STRENGTH_META: Record<PasswordStrength, { label: string; bar: string; text: string }> = {
  weak: { label: "Weak", bar: "bg-destructive", text: "text-destructive" },
  fair: { label: "Fair", bar: "bg-warning", text: "text-warning" },
  good: { label: "Good", bar: "bg-chart-1", text: "text-chart-1" },
  strong: { label: "Strong", bar: "bg-chart-2", text: "text-chart-2" },
};