export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AccountStatus = 'active' | 'inactive';
type RoomStatus = 'active' | 'archived';
type CalendarView = 'week' | 'month';
type RoomRole = 'owner' | 'manager' | 'member';
type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'normal' | 'high';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          phone: string | null;
          is_service_admin: boolean;
          status: AccountStatus;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          phone?: string | null;
          is_service_admin?: boolean;
          status?: AccountStatus;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          email?: string;
          name?: string;
          phone?: string | null;
          is_service_admin?: boolean;
          status?: AccountStatus;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Relationships: [];
      };
      scheduling_rooms: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string;
          shared_schedule_color: string;
          owner_user_id: string;
          status: RoomStatus;
          default_view: CalendarView;
          business_start_time: string;
          business_end_time: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string;
          shared_schedule_color?: string;
          owner_user_id: string;
          status?: RoomStatus;
          default_view?: CalendarView;
          business_start_time?: string;
          business_end_time?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          color?: string;
          shared_schedule_color?: string;
          owner_user_id?: string;
          status?: RoomStatus;
          default_view?: CalendarView;
          business_start_time?: string;
          business_end_time?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      room_members: {
        Row: {
          id: string;
          room_id: string;
          user_id: string;
          nickname: string;
          role: RoomRole;
          color: string;
          joined_at: string;
          last_active_at: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          user_id: string;
          nickname: string;
          role?: RoomRole;
          color?: string;
          joined_at?: string;
          last_active_at?: string | null;
        };
        Update: {
          nickname?: string;
          role?: RoomRole;
          color?: string;
          last_active_at?: string | null;
        };
        Relationships: [];
      };
      room_invites: {
        Row: {
          id: string;
          room_id: string;
          code: string;
          created_by_user_id: string;
          expires_at: string | null;
          max_uses: number | null;
          used_count: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          code: string;
          created_by_user_id: string;
          expires_at?: string | null;
          max_uses?: number | null;
          used_count?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          code?: string;
          expires_at?: string | null;
          max_uses?: number | null;
          used_count?: number;
          is_active?: boolean;
        };
        Relationships: [];
      };
      schedules: {
        Row: {
          id: string;
          room_id: string;
          title: string;
          start_at: string;
          end_at: string;
          address: string | null;
          customer_phone: string | null;
          estimated_price: number | null;
          additional_info: string | null;
          status: ScheduleStatus;
          created_by_member_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          room_id: string;
          title: string;
          start_at: string;
          end_at: string;
          address?: string | null;
          customer_phone?: string | null;
          estimated_price?: number | null;
          additional_info?: string | null;
          status?: ScheduleStatus;
          created_by_member_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          start_at?: string;
          end_at?: string;
          address?: string | null;
          customer_phone?: string | null;
          estimated_price?: number | null;
          additional_info?: string | null;
          status?: ScheduleStatus;
          created_by_member_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      schedule_participants: {
        Row: {
          schedule_id: string;
          room_member_id: string;
          created_at: string;
        };
        Insert: {
          schedule_id: string;
          room_member_id: string;
          created_at?: string;
        };
        Update: {
          schedule_id?: string;
          room_member_id?: string;
        };
        Relationships: [];
      };
      schedule_user_states: {
        Row: {
          schedule_id: string;
          user_id: string;
          is_checked: boolean;
          updated_at: string;
        };
        Insert: {
          schedule_id: string;
          user_id: string;
          is_checked?: boolean;
          updated_at?: string;
        };
        Update: {
          is_checked?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      preliminary_tasks: {
        Row: {
          id: string;
          user_id: string;
          room_id: string | null;
          title: string;
          memo: string | null;
          priority: TaskPriority;
          due_date: string | null;
          is_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          room_id?: string | null;
          title: string;
          memo?: string | null;
          priority?: TaskPriority;
          due_date?: string | null;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          room_id?: string | null;
          title?: string;
          memo?: string | null;
          priority?: TaskPriority;
          due_date?: string | null;
          is_completed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          push_enabled: boolean;
          default_calendar_view: CalendarView;
          filter_opacity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          push_enabled?: boolean;
          default_calendar_view?: CalendarView;
          filter_opacity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          push_enabled?: boolean;
          default_calendar_view?: CalendarView;
          filter_opacity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      create_scheduling_room: {
        Args: {
          p_name: string;
          p_description: string | null;
          p_nickname: string;
          p_color: string;
          p_shared_schedule_color: string;
          p_default_view: CalendarView;
          p_business_start_time: string;
          p_business_end_time: string;
        };
        Returns: Json;
      };
      join_room_by_invite: {
        Args: {
          p_code: string;
          p_nickname: string;
          p_color: string;
        };
        Returns: Json;
      };
      set_room_manager_role: {
        Args: {
          p_room_id: string;
          p_member_id: string;
          p_is_manager: boolean;
        };
        Returns: undefined;
      };
      transfer_room_ownership: {
        Args: {
          p_room_id: string;
          p_new_owner_member_id: string;
        };
        Returns: undefined;
      };
      is_service_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_room_member: {
        Args: {
          p_room_id: string;
        };
        Returns: boolean;
      };
      current_room_role: {
        Args: {
          p_room_id: string;
        };
        Returns: RoomRole | null;
      };
      can_manage_room_schedules: {
        Args: {
          p_room_id: string;
        };
        Returns: boolean;
      };
      is_schedule_participant: {
        Args: {
          p_schedule_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
