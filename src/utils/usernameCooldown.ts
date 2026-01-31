const COOLDOWN_DAYS = 30;

export interface UsernameCooldownState {
  isLocked: boolean;
  nextChangeDate: Date | null;
  formattedNextChangeDate: string | null;
  isFirstChange: boolean;
}

export const calculateUsernameCooldown = (
  usernameChangedAt: string | null
): UsernameCooldownState => {
  // First change is always free
  if (!usernameChangedAt) {
    return {
      isLocked: false,
      nextChangeDate: null,
      formattedNextChangeDate: null,
      isFirstChange: true
    };
  }
  
  const lastChange = new Date(usernameChangedAt);
  const nextChange = new Date(lastChange);
  nextChange.setDate(nextChange.getDate() + COOLDOWN_DAYS);
  
  const now = new Date();
  const isLocked = now < nextChange;
  
  return {
    isLocked,
    nextChangeDate: isLocked ? nextChange : null,
    formattedNextChangeDate: isLocked 
      ? nextChange.toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        })
      : null,
    isFirstChange: false
  };
};
