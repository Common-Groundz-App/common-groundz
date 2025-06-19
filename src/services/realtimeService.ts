
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RealtimeEventHandler<T = any> {
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: T) => void;
  onDelete?: (payload: T) => void;
}

export class RealtimeService {
  private channels: Map<string, RealtimeChannel> = new Map();

  // Subscribe to table changes
  subscribeToTable<T>(
    tableName: string,
    handler: RealtimeEventHandler<T>,
    filter?: { column: string; value: string }
  ): string {
    const channelName = `${tableName}-${Date.now()}`;
    
    let channel = supabase.channel(channelName);

    if (filter) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
          filter: `${filter.column}=eq.${filter.value}`
        },
        (payload) => {
          this.handleTableChange(payload, handler);
        }
      );
    } else {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName
        },
        (payload) => {
          this.handleTableChange(payload, handler);
        }
      );
    }

    channel.subscribe();
    this.channels.set(channelName, channel);
    
    return channelName;
  }

  // Subscribe to user presence
  subscribeToPresence(
    roomId: string,
    onJoin?: (users: any[]) => void,
    onLeave?: (users: any[]) => void
  ): string {
    const channelName = `presence-${roomId}`;
    
    const channel = supabase
      .channel(channelName)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat();
        onJoin?.(users);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        onJoin?.(newPresences);
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        onLeave?.(leftPresences);
      });

    channel.subscribe();
    this.channels.set(channelName, channel);
    
    return channelName;
  }

  // Track user presence
  async trackPresence(channelName: string, userState: any) {
    const channel = this.channels.get(channelName);
    if (channel) {
      await channel.track(userState);
    }
  }

  // Unsubscribe from a channel
  unsubscribe(channelName: string) {
    const channel = this.channels.get(channelName);
    if (channel) {
      supabase.removeChannel(channel);
      this.channels.delete(channelName);
    }
  }

  // Unsubscribe from all channels
  unsubscribeAll() {
    this.channels.forEach((channel, name) => {
      supabase.removeChannel(channel);
    });
    this.channels.clear();
  }

  private handleTableChange<T>(payload: any, handler: RealtimeEventHandler<T>) {
    switch (payload.eventType) {
      case 'INSERT':
        handler.onInsert?.(payload.new as T);
        break;
      case 'UPDATE':
        handler.onUpdate?.(payload.new as T);
        break;
      case 'DELETE':
        handler.onDelete?.(payload.old as T);
        break;
    }
  }
}

export const realtimeService = new RealtimeService();
