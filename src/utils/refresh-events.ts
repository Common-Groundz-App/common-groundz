
/**
 * Utility for managing content refresh events across the application
 */

export type RefreshEventType = 
  | 'feed'
  | 'posts'
  | 'profile-posts' 
  | 'reviews' 
  | 'recommendations'
  | 'comments';

/**
 * Trigger a refresh event for the specified content type
 * @param eventType The type of content to refresh
 * @param itemId Optional specific item ID
 */
export const triggerRefreshEvent = (eventType: RefreshEventType, itemId?: string) => {
  let eventName: string;
  
  switch (eventType) {
    case 'feed':
      eventName = 'refresh-feed';
      break;
    case 'posts':
      eventName = 'refresh-posts';
      break;
    case 'profile-posts':
      eventName = 'refresh-profile-posts';
      break;
    case 'reviews':
      eventName = 'refresh-reviews';
      break;
    case 'recommendations':
      eventName = 'refresh-recommendations';
      break;
    case 'comments':
      if (!itemId) {
        console.error('Item ID is required for comment refresh events');
        return;
      }
      eventName = `refresh-${itemId}-comments`;
      break;
    default:
      eventName = `refresh-${eventType}`;
  }
  
  const detail = itemId ? { itemId } : undefined;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
};

/**
 * Listen for refresh events for the specified content type
 * @param eventType The type of content to listen for refresh events
 * @param callback Function to execute when the event is triggered
 * @param itemId Optional specific item ID
 * @returns Cleanup function to remove the event listener
 */
export const listenForRefreshEvents = (
  eventType: RefreshEventType, 
  callback: (detail?: any) => void,
  itemId?: string
): () => void => {
  let eventName: string;
  
  switch (eventType) {
    case 'feed':
      eventName = 'refresh-feed';
      break;
    case 'posts':
      eventName = 'refresh-posts';
      break;
    case 'profile-posts':
      eventName = 'refresh-profile-posts';
      break;
    case 'reviews':
      eventName = 'refresh-reviews';
      break;
    case 'recommendations':
      eventName = 'refresh-recommendations';
      break;
    case 'comments':
      if (!itemId) {
        console.error('Item ID is required for comment refresh events');
        return () => {};
      }
      eventName = `refresh-${itemId}-comments`;
      break;
    default:
      eventName = `refresh-${eventType}`;
  }
  
  const handleEvent = (event: Event) => {
    // If this is a specific item event and we have an itemId filter
    if (itemId && (event as CustomEvent).detail?.itemId) {
      if ((event as CustomEvent).detail.itemId === itemId) {
        callback((event as CustomEvent).detail);
      }
    } else {
      callback((event as CustomEvent)?.detail);
    }
  };
  
  window.addEventListener(eventName, handleEvent);
  
  return () => {
    window.removeEventListener(eventName, handleEvent);
  };
};
