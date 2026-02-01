import { AUTH_CONFIG } from '@/config/authConfig';

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
  feedback: string[];
  meetsMinimum: boolean;
}

export const calculatePasswordStrength = (password: string): PasswordStrength => {
  const feedback: string[] = [];
  let score = 0;

  // Check minimum length
  if (password.length >= AUTH_CONFIG.MIN_PASSWORD_LENGTH) {
    score++;
  } else {
    feedback.push(`Use at least ${AUTH_CONFIG.MIN_PASSWORD_LENGTH} characters`);
  }

  // Bonus for longer passwords
  if (password.length >= 12) {
    score++;
  }

  // Check for mixed case
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  } else if (password.length > 0) {
    feedback.push('Mix uppercase and lowercase letters');
  }

  // Check for numbers
  if (/\d/.test(password)) {
    score++;
  } else if (password.length > 0) {
    feedback.push('Add a number');
  }

  // Check for special characters
  if (/[^a-zA-Z0-9]/.test(password)) {
    score++;
  } else if (password.length > 0) {
    feedback.push('Add a special character');
  }

  // Cap score at 4
  const cappedScore = Math.min(score, 4) as PasswordStrength['score'];

  const labels: PasswordStrength['label'][] = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  const colors = [
    'bg-destructive',
    'bg-orange-500',
    'bg-yellow-500',
    'bg-lime-500',
    'bg-green-500'
  ];

  return {
    score: cappedScore,
    label: labels[cappedScore],
    color: colors[cappedScore],
    feedback: cappedScore < AUTH_CONFIG.MIN_PASSWORD_SCORE ? feedback.slice(0, 2) : [],
    meetsMinimum: cappedScore >= AUTH_CONFIG.MIN_PASSWORD_SCORE
  };
};
