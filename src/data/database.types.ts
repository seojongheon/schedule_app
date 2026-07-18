export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type AccountStatus = 'active' | 'inactive';
export type AccountState =
  | 'pending_email_verification'
  | 'pending_profile'
  | 'pending_guardian_consent'
  | 'active'
  | 'restricted'
  | 'suspended'
  | 'deletion_pending'
  | 'deleted';
type RoomStatus = 'active' | 'archived';
type CalendarView = 'week' | 'month';
export type RoomRole = 'owner' | 'manager' | 'member' | 'viewer';
export type ServiceRole = 'super_admin' | 'operations_admin' | 'support_admin' | 'auditor';
type ScheduleStatus = 'scheduled' | 'completed' | 'cancelled';
type TaskPriority = 'low' | 'normal' | 'high';

type GeneratedTable<Row> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

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
          display_name: string;
          account_state: AccountState;
          is_under_14: boolean;
          terms_version: string | null;
          privacy_version: string | null;
          terms_accepted_at: string | null;
          privacy_accepted_at: string | null;
          session_started_at: string | null;
          last_seen_at: string | null;
          last_reauthenticated_at: string | null;
          deletion_requested_at: string | null;
          deletion_due_at: string | null;
          deletion_subject_key: string | null;
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
          display_name?: string;
          account_state?: AccountState;
          is_under_14?: boolean;
          terms_version?: string | null;
          privacy_version?: string | null;
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
          session_started_at?: string | null;
          last_seen_at?: string | null;
          last_reauthenticated_at?: string | null;
          deletion_requested_at?: string | null;
          deletion_due_at?: string | null;
          deletion_subject_key?: string | null;
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
          display_name?: string;
          account_state?: AccountState;
          is_under_14?: boolean;
          terms_version?: string | null;
          privacy_version?: string | null;
          terms_accepted_at?: string | null;
          privacy_accepted_at?: string | null;
          session_started_at?: string | null;
          last_seen_at?: string | null;
          last_reauthenticated_at?: string | null;
          deletion_requested_at?: string | null;
          deletion_due_at?: string | null;
          deletion_subject_key?: string | null;
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
          visibility: 'private' | 'invite_preview';
          restriction_state: 'active' | 'restricted';
          restricted_until: string | null;
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
          visibility?: 'private' | 'invite_preview';
          restriction_state?: 'active' | 'restricted';
          restricted_until?: string | null;
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
          visibility?: 'private' | 'invite_preview';
          restriction_state?: 'active' | 'restricted';
          restricted_until?: string | null;
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
          expires_at: string;
          max_uses: number;
          used_count: number;
          is_active: boolean;
          created_at: string;
          token_hash: string;
          token_hint: string | null;
          grant_role: 'member' | 'viewer';
          status: 'active' | 'revoked' | 'expired' | 'exhausted' | 'replaced';
          revoked_by_user_id: string | null;
          revoked_at: string | null;
          revocation_reason: string | null;
          replacement_invite_id: string | null;
        };
        Insert: {
          id?: string;
          room_id: string;
          code: string;
          created_by_user_id: string;
          expires_at: string;
          max_uses: number;
          used_count?: number;
          is_active?: boolean;
          created_at?: string;
          token_hash: string;
          token_hint?: string | null;
          grant_role?: 'member' | 'viewer';
          status?: 'active' | 'revoked' | 'expired' | 'exhausted' | 'replaced';
          revoked_by_user_id?: string | null;
          revoked_at?: string | null;
          revocation_reason?: string | null;
          replacement_invite_id?: string | null;
        };
        Update: {
          code?: string;
          expires_at?: string;
          max_uses?: number;
          used_count?: number;
          is_active?: boolean;
          token_hash?: string;
          token_hint?: string | null;
          grant_role?: 'member' | 'viewer';
          status?: 'active' | 'revoked' | 'expired' | 'exhausted' | 'replaced';
          revoked_by_user_id?: string | null;
          revoked_at?: string | null;
          revocation_reason?: string | null;
          replacement_invite_id?: string | null;
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
      private_profiles: GeneratedTable<{
        user_id: string; phone_ciphertext: string | null; phone_iv: string | null;
        phone_auth_tag: string | null; phone_lookup_hash: string | null;
        birth_date_ciphertext: string | null; birth_date_iv: string | null;
        birth_date_auth_tag: string | null; key_version: number;
        created_at: string; updated_at: string;
      }>;
      account_email_references: GeneratedTable<{
        user_id: string; email_lookup_hash: string; verified_at: string | null;
        created_at: string; updated_at: string;
      }>;
      guardian_consents: GeneratedTable<{
        id: string; child_user_id: string;
        status: 'pending' | 'approved' | 'rejected' | 'expired' | 'withdrawn';
        guardian_name_ciphertext: string | null; guardian_name_iv: string | null;
        guardian_name_auth_tag: string | null; guardian_phone_ciphertext: string | null;
        guardian_phone_iv: string | null; guardian_phone_auth_tag: string | null;
        guardian_phone_lookup_hash: string | null; key_version: number; provider: string;
        evidence_reference: string; terms_version: string; privacy_version: string;
        requested_at: string; verified_at: string | null; expires_at: string;
        withdrawn_at: string | null; created_at: string; updated_at: string;
      }>;
      service_role_assignments: GeneratedTable<{
        id: string; user_id: string; role: ServiceRole; granted_by_user_id: string;
        granted_at: string; revoked_by_user_id: string | null; revoked_at: string | null;
        reason: string;
      }>;
      invitation_attempts: GeneratedTable<{
        id: string; invite_id: string | null; actor_user_id: string | null;
        ip_key: string; event_type: 'preview' | 'validate' | 'redeem' | 'deny';
        result_code: string; request_id: string; occurred_at: string;
      }>;
      support_inquiries: GeneratedTable<{
        id: string; user_id: string; category: 'general' | 'account' | 'consent' | 'privacy' | 'appeal';
        subject: string; body_ciphertext: string; body_iv: string; body_auth_tag: string;
        key_version: number; status: 'open' | 'in_progress' | 'answered' | 'closed';
        assigned_to_user_id: string | null; created_at: string; updated_at: string;
        closed_at: string | null; retention_until: string | null;
      }>;
      support_inquiry_messages: GeneratedTable<{
        id: string; inquiry_id: string; author_user_id: string; author_kind: 'user' | 'admin';
        body_ciphertext: string; body_iv: string; body_auth_tag: string;
        key_version: number; created_at: string;
      }>;
      admin_notifications: GeneratedTable<{
        id: string; audience_role: 'support_admin' | 'operations_admin' | 'super_admin';
        type: 'new_inquiry' | 'inquiry_reply' | 'aging_inquiry' | 'security_alert' | 'job_failure';
        target_type: string; target_id: string; read_by_user_ids: string[]; created_at: string;
      }>;
      user_notifications: GeneratedTable<{
        id: string; user_id: string; type: 'inquiry_reply' | 'inquiry_status';
        target_type: 'inquiry'; target_id: string; read_at: string | null; created_at: string;
      }>;
      reports: GeneratedTable<{
        id: string; reporter_user_id: string; target_type: 'account' | 'room'; target_id: string;
        reason_code: string; detail_ciphertext: string | null; detail_iv: string | null;
        detail_auth_tag: string | null; key_version: number | null;
        status: 'open' | 'investigating' | 'resolved' | 'dismissed';
        assigned_to_user_id: string | null; created_at: string; resolved_at: string | null;
      }>;
      sanctions: GeneratedTable<{
        id: string; target_type: 'account' | 'room'; target_id: string;
        sanction_type: 'restrict' | 'suspend'; reason: string; starts_at: string;
        ends_at: string | null; imposed_by_user_id: string; released_by_user_id: string | null;
        released_at: string | null; release_reason: string | null;
      }>;
      audit_events: GeneratedTable<{
        id: string; event_type: string; actor_type: 'user' | 'admin' | 'system' | 'anonymous';
        actor_key: string; target_type: string; target_key: string;
        result: 'success' | 'denied' | 'failure'; reason_code: string; request_id: string;
        metadata: Json; occurred_at: string; retention_until: string;
      }>;
      rate_limit_counters: GeneratedTable<{
        scope: 'general_ip' | 'sensitive_ip' | 'login_account'; subject_key: string;
        window_started_at: string; request_count: number; updated_at: string;
      }>;
      rate_limit_violations: GeneratedTable<{
        id: string; subject_key: string; policy: 'general' | 'sensitive';
        occurred_at: string; request_id: string; retention_until: string;
      }>;
      ip_blocks: GeneratedTable<{
        id: string; ip_key: string; blocked_at: string; blocked_until: string;
        source: 'automatic' | 'manual'; reason: string; released_by_user_id: string | null;
        released_at: string | null; release_reason: string | null;
      }>;
      deletion_records: GeneratedTable<{
        subject_key: string; requested_at: string; due_at: string;
        completed_at: string | null; replayed_at: string | null; result_code: string;
      }>;
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
      has_service_capability: { Args: { p_capability: string }; Returns: boolean };
      is_active_account: { Args: { p_user_id?: string }; Returns: boolean };
      record_verified_authentication: { Args: { p_actor_user_id: string; p_request_id: string }; Returns: undefined };
      touch_session_activity: { Args: { p_actor_user_id: string }; Returns: undefined };
      create_room_invite: {
        Args: { p_actor_user_id: string; p_room_id: string; p_token_hash: string; p_token_hint: string; p_grant_role: string;
          p_expires_at: string; p_max_uses: number; p_ip_key: string; p_request_id: string };
        Returns: string | null;
      };
      revoke_room_invite: {
        Args: { p_actor_user_id: string; p_room_id: string; p_invite_id: string; p_reason: string; p_ip_key: string; p_request_id: string };
        Returns: boolean;
      };
      replace_room_invite: {
        Args: { p_actor_user_id: string; p_room_id: string; p_invite_id: string; p_token_hash: string; p_token_hint: string;
          p_expires_at: string; p_max_uses: number; p_reason: string; p_ip_key: string; p_request_id: string };
        Returns: string | null;
      };
      redeem_room_invite: {
        Args: { p_actor_user_id: string; p_token_hash: string; p_nickname: string; p_color: string;
          p_ip_key: string; p_request_id: string };
        Returns: Json;
      };
      evaluate_request_limit: {
        Args: { p_scope: string; p_subject_key: string; p_policy: string;
          p_request_id: string; p_now?: string };
        Returns: Json;
      };
      complete_commercial_profile: {
        Args: {
          p_display_name: string; p_is_under_14: boolean; p_terms_version: string; p_privacy_version: string;
          p_email_lookup_hash: string; p_phone_ciphertext: string | null; p_phone_iv: string | null;
          p_phone_auth_tag: string | null; p_phone_lookup_hash: string | null;
          p_birth_date_ciphertext: string; p_birth_date_iv: string; p_birth_date_auth_tag: string;
          p_key_version: number; p_request_id: string;
        };
        Returns: string;
      };
      append_audit_event: {
        Args: {
          p_event_type: string; p_actor_type: string; p_actor_key: string;
          p_target_type: string; p_target_key: string; p_result: string;
          p_reason_code: string; p_request_id: string; p_metadata?: Json;
        };
        Returns: string;
      };
      list_support_inquiry_metadata: {
        Args: { p_actor_user_id: string; p_offset: number; p_limit: number; p_request_id: string };
        Returns: Json;
      };
      create_support_inquiry: {
        Args: {
          p_inquiry_id: string; p_actor_user_id: string; p_category: string; p_subject: string;
          p_body_ciphertext: string; p_body_iv: string; p_body_auth_tag: string;
          p_key_version: number; p_request_id: string;
        };
        Returns: Json;
      };
      read_support_inquiry_content: {
        Args: { p_inquiry_id: string; p_actor_user_id: string; p_request_id: string };
        Returns: Json;
      };
      claim_support_inquiry: {
        Args: { p_inquiry_id: string; p_actor_user_id: string; p_request_id: string };
        Returns: Json;
      };
      reply_support_inquiry: {
        Args: {
          p_message_id: string; p_inquiry_id: string; p_actor_user_id: string;
          p_body_ciphertext: string; p_body_iv: string; p_body_auth_tag: string;
          p_key_version: number; p_request_id: string;
        };
        Returns: Json;
      };
      change_support_inquiry_status: {
        Args: { p_inquiry_id: string; p_actor_user_id: string; p_status: string; p_request_id: string };
        Returns: Json;
      };
      enqueue_aging_inquiry_notifications: {
        Args: { p_cutoff: string; p_request_id: string };
        Returns: number;
      };
      export_private_profile: {
        Args: { p_request_id: string };
        Returns: Array<{
          phone_ciphertext: string | null; phone_iv: string | null; phone_auth_tag: string | null;
          birth_date_ciphertext: string | null; birth_date_iv: string | null; birth_date_auth_tag: string | null;
          key_version: number;
        }>;
      };
      correct_private_profile_phone: {
        Args: {
          p_phone_ciphertext: string | null; p_phone_iv: string | null; p_phone_auth_tag: string | null;
          p_phone_lookup_hash: string | null; p_key_version: number; p_request_id: string;
        };
        Returns: undefined;
      };
      begin_account_withdrawal: {
        Args: { p_subject_key: string; p_request_id: string };
        Returns: string;
      };
      cancel_account_withdrawal: {
        Args: { p_subject_key: string; p_request_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
