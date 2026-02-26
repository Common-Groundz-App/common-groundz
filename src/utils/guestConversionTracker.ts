/**
 * Lightweight guest conversion tracking utility.
 * Console.log implementation — swap for analytics provider later.
 */
export const trackGuestEvent = (
  eventName: string,
  metadata?: Record<string, unknown>
): void => {
  console.log(`[GuestTrack] ${eventName}`, metadata ?? {});
};
