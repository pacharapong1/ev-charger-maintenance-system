// Mirrors the SQL objects created by 01_schema.sql.
// Consumed by SupabaseClient<Database> so every query is type checked against
// the real column names and role values.

export type Role = 'Admin' | 'Technician' | 'Viewer' | 'Engineer';

// The four statuses the course specification names explicitly: Running, Stop,
// Alarm and Maintenance. The order is the display order used by the dashboard.
export type MachineStatus = 'Running' | 'Stop' | 'Alarm' | 'Maintenance';
export type AlarmStatus = 'Open' | 'In Progress' | 'Closed';
export type MaintenanceStatus = 'In Progress' | 'Completed' | 'Waiting Part';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
  /**
   * bcrypt hash. SELECT on this column is revoked in 02_rls.sql, so it can never
   * appear in a query result; it is typed here only because the column exists.
   * Nothing in the application reads it.
   */
  password_hash: string;
  created_at: string;
};

export type Machine = {
  id: string;
  machine_id: string;
  name: string;
  type: string;
  location: string | null;
  status: MachineStatus;
  created_at: string;
  updated_at: string;
};

export type Alarm = {
  id: string;
  machine_id: string;
  alarm_code: string;
  description: string;
  cause: string | null;
  status: AlarmStatus;
  /** Peak telemetry from 05_alarm_telemetry.sql; null when never reported. */
  voltage_peak: number | null;
  temperature_peak: number | null;
  current_peak: number | null;
  created_at: string;
  updated_at: string;
};

export type MaintenanceRecord = {
  id: string;
  alarm_id: string | null;
  machine_id: string;
  technician_id: string | null;
  action_taken: string;
  status: MaintenanceStatus;
  created_at: string;
  updated_at: string;
};

/**
 * Foreign key metadata.
 *
 * The postgrest-js type parser needs this to understand embedded resources like
 * `select('*, machines(machine_id)')`. Without it the embed is typed as a
 * SelectQueryError instead of the joined row, which silently degrades every
 * nested select to an error type.
 */
type Relation = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<
  Row,
  Insert = Partial<Row>,
  Update = Partial<Insert>,
  Relationships extends Relation[] = [],
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type View<Row> = {
  Row: Row;
  Relationships: [];
};

/** Row shape of public.machine_status_summary (see 04_dashboard_views.sql). */
export type MachineStatusSummary = {
  status: MachineStatus;
  station_count: number;
};

/** Row shape of public.top_alarm_codes (see 04_dashboard_views.sql). */
export type TopAlarmCode = {
  alarm_code: string;
  occurrences: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        // Accounts are created from the Supabase SQL editor, not from the app:
        // there is no sign-up, and no INSERT policy, so this shape describes the
        // table for completeness rather than describing a path the code takes.
        { id?: string; username: string; full_name?: string | null; role?: Role; password_hash: string },
        { username?: string; full_name?: string | null; role?: Role; password_hash?: string }
      >;
      machines: Table<
        Machine,
        {
          machine_id: string;
          name: string;
          type: string;
          location?: string | null;
          status?: MachineStatus;
        },
        {
          machine_id?: string;
          name?: string;
          type?: string;
          location?: string | null;
          status?: MachineStatus;
        }
      >;
      alarms: Table<
        Alarm,
        {
          machine_id: string;
          alarm_code: string;
          description: string;
          cause?: string | null;
          status?: AlarmStatus;
          voltage_peak?: number | null;
          temperature_peak?: number | null;
          current_peak?: number | null;
          created_at?: string;
        },
        {
          machine_id?: string;
          alarm_code?: string;
          description?: string;
          cause?: string | null;
          status?: AlarmStatus;
          voltage_peak?: number | null;
          temperature_peak?: number | null;
          current_peak?: number | null;
        },
        [
          {
            foreignKeyName: 'alarms_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
        ]
      >;
      maintenance_records: Table<
        MaintenanceRecord,
        {
          alarm_id?: string | null;
          machine_id: string;
          technician_id?: string | null;
          action_taken: string;
          status?: MaintenanceStatus;
          created_at?: string;
        },
        {
          alarm_id?: string | null;
          machine_id?: string;
          technician_id?: string | null;
          action_taken?: string;
          status?: MaintenanceStatus;
        },
        [
          {
            foreignKeyName: 'maintenance_records_alarm_id_fkey';
            columns: ['alarm_id'];
            isOneToOne: false;
            referencedRelation: 'alarms';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_records_machine_id_fkey';
            columns: ['machine_id'];
            isOneToOne: false;
            referencedRelation: 'machines';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'maintenance_records_technician_id_fkey';
            columns: ['technician_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ]
      >;
    };
    Views: {
      machine_status_summary: View<MachineStatusSummary>;
      top_alarm_codes: View<TopAlarmCode>;
    };
    Functions: {
      current_role: { Args: Record<PropertyKey, never>; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_engineer: { Args: Record<PropertyKey, never>; Returns: boolean };
      /**
       * The project's own sign-in. Returns the identity as jsonb on success and
       * null for both a wrong password and an unknown username, so the response
       * cannot be used to work out which accounts exist.
       */
      login: { Args: { p_username: string; p_password: string }; Returns: Json };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type { Json };
