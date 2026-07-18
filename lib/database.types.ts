// =====================================================================
// PickUp — database.types.ts
// HAND-WRITTEN from docs/pickup_schema.sql (Decision D3). The schema is ALREADY
// APPLIED to the live Supabase DB — never recreate or migrate it. This file
// only mirrors it so our TypeScript is type-safe. If the Supabase CLI gets
// wired up later, regenerate with `supabase gen types` to confirm parity.
// Glossary (Doc 00): Business · Dispatcher · Driver · Guest · Pool · PDP ·
// Ceiling · SPEED WIN. Never "client" / "principal".
//
// NOTE: each table carries `Relationships: []` and the schema carries
// `CompositeTypes` so this satisfies supabase-js's GenericSchema constraint
// (otherwise the typed client collapses every row to `never`). We don't model
// FK relationships for typed joins in V1 — `[]` is intentional.
// =====================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------- ENUMS ----------
export type UserRole = "driver" | "dispatcher" | "admin";
// vehicle_category is the SERVICE TIER. 'van' is legacy (migrated to
// business+body=van on 2026-06-19); tiers offered now: eco/business/luxury.
export type VehicleCategory = "eco" | "business" | "van" | "luxury";
export type BodyType = "sedan" | "van";
export type MissionType = "transfer" | "hourly";
export type MissionStatus =
  | "draft"
  | "pooled"
  | "accepted"
  | "confirmed"
  | "en_route"
  | "arrived"
  | "on_board"
  | "completed"
  | "cancelled"
  | "expired";
export type CancellationParty = "driver" | "business" | "system";
export type DocumentType =
  | "drivers_licence"
  | "vtc_card"
  | "revtc"
  | "insurance"
  | "rc_pro"
  | "vehicle_registration"
  | "company_registration";
export type DocumentStatus = "pending" | "verified" | "rejected";
export type PaymentStatus = "requires_capture" | "captured" | "refunded" | "failed";

// mission_amendment.status is a text CHECK (Phase-2 edit / consent flow, D39):
// proposed → accepted | declined, or superseded when the Business replaces it.
export type AmendmentStatus = "proposed" | "accepted" | "declined" | "superseded";

// status_event.status is a text CHECK, not the mission_status enum.
export type StatusEventStatus = "en_route" | "arrived" | "on_board" | "completed";
export type PreferredGps = "waze" | "google" | "apple";

// A single waypoint (mission.waypoints jsonb). Shape is app-defined.
export interface Waypoint {
  address: string;
  lat?: number | null;
  lng?: number | null;
}

export interface Database {
  public: {
    Tables: {
      profile: {
        Row: { auth_user_id: string; role: UserRole; created_at: string };
        Insert: { auth_user_id: string; role: UserRole; created_at?: string };
        Update: { auth_user_id?: string; role?: UserRole; created_at?: string };
        Relationships: [];
      };
      business: {
        Row: {
          id: string;
          name: string;
          field_of_activity: string | null; // legacy free-text (superseded by business_type)
          logo_url: string | null;
          stripe_customer_id: string | null;
          // Company identity (2026-06-28 migration) — human-verified off the Kbis.
          business_type: string | null;
          legal_name: string | null;
          siret: string | null;
          vat_number: string | null;
          registered_address: string | null;
          reception_phone: string | null;
          // Booking defaults. business_address = the Business's own address (used on
          // either end); prefill_pickup = auto-fill it into a new mission's pickup.
          business_address: string | null;
          business_address_lat: number | null;
          business_address_lng: number | null;
          business_address_label: string | null;
          prefill_pickup: boolean;
          default_vehicle_category: string | null;
          default_booking_notes: string | null; // legacy (Guest-instructions field removed)
          // Billing (storable now; Stripe deferred).
          billing_email: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          field_of_activity?: string | null;
          logo_url?: string | null;
          stripe_customer_id?: string | null;
          business_type?: string | null;
          legal_name?: string | null;
          siret?: string | null;
          vat_number?: string | null;
          registered_address?: string | null;
          reception_phone?: string | null;
          business_address?: string | null;
          business_address_lat?: number | null;
          business_address_lng?: number | null;
          business_address_label?: string | null;
          prefill_pickup?: boolean;
          default_vehicle_category?: string | null;
          default_booking_notes?: string | null;
          billing_email?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business"]["Insert"]>;
        Relationships: [];
      };
      dispatcher: {
        Row: {
          id: string;
          business_id: string;
          auth_user_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          auth_user_id: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dispatcher"]["Insert"]>;
        Relationships: [];
      };
      driver: {
        Row: {
          id: string;
          auth_user_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          email: string | null;
          profile_photo_url: string | null;
          languages: string[];
          operational_zones: string[];
          base_label: string | null;
          base_lat: number | null;
          base_lng: number | null;
          service_radius_km: number;
          accepts_luggage_runs: boolean; // opted in to bags-only Van runs (Sujet B, Phase 1)
          preferred_gps: PreferredGps | null;
          stripe_account_id: string | null;
          verified: boolean;
          reliability_marks: number; // O7 (D45): running count of cancel / no-confirm marks
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          email?: string | null;
          profile_photo_url?: string | null;
          languages?: string[];
          operational_zones?: string[];
          base_label?: string | null;
          base_lat?: number | null;
          base_lng?: number | null;
          service_radius_km?: number;
          accepts_luggage_runs?: boolean;
          preferred_gps?: PreferredGps | null;
          stripe_account_id?: string | null;
          verified?: boolean;
          reliability_marks?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["driver"]["Insert"]>;
        Relationships: [];
      };
      vehicle: {
        Row: {
          id: string;
          driver_id: string;
          category: VehicleCategory;
          body_type: BodyType;
          make: string | null;
          model: string | null;
          colour: string | null;
          plate: string | null;
          seats: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          category: VehicleCategory;
          body_type?: BodyType;
          make?: string | null;
          model?: string | null;
          colour?: string | null;
          plate?: string | null;
          seats?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["vehicle"]["Insert"]>;
        Relationships: [];
      };
      document: {
        Row: {
          id: string;
          owner_type: "driver" | "business";
          owner_id: string;
          type: DocumentType;
          file_url: string;
          status: DocumentStatus;
          expires_at: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          owner_type: "driver" | "business";
          owner_id: string;
          type: DocumentType;
          file_url: string;
          status?: DocumentStatus;
          expires_at?: string | null;
          uploaded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document"]["Insert"]>;
        Relationships: [];
      };
      mission: {
        Row: {
          id: string;
          business_id: string;
          dispatcher_id: string;
          driver_id: string | null;
          status: MissionStatus;
          mission_type: MissionType;
          group_id: string | null;
          category: VehicleCategory;
          zone: string | null;
          pickup_address: string;
          pickup_lat: number | null;
          pickup_lng: number | null;
          dropoff_address: string | null;
          dropoff_lat: number | null;
          dropoff_lng: number | null;
          pickup_label: string | null;
          dropoff_label: string | null;
          waypoints: Json | null;
          stops_reached: number; // count of intermediate stops the Driver has marked reached
          pickup_at: string;
          flight_number: string | null;
          flight_eta: string | null;
          passenger_name: string | null;
          passenger_names: Json | null;
          pax_count: number | null;
          luggage_count: number | null;
          luggage_only: boolean; // bags-only run, no passengers, carried in a Van (Sujet B, Phase 1)
          comment: string | null;
          reference: string | null;
          base_fare: number | null;
          ceiling: number;
          pdp_start: number | null;
          pdp_step: number | null;
          pdp_interval: number | null;
          speed_win: boolean;
          required_body_type: BodyType | null;
          required_make: string | null;
          required_model: string | null;
          required_languages: string[] | null;
          dress_code: string | null;
          driver_flags: Json | null;
          board_name: string | null;
          board_file_path: string | null;
          driver_message: string | null;
          distance_km: number | null;
          duration_min: number | null;
          cancelled_by: CancellationParty | null;
          cancelled_at: string | null;
          created_at: string;
          accepted_at: string | null;
          confirmed_at: string | null;
          info_edited_at: string | null; // set by updateMissionInfo on an info-only edit (2026-07-05 migration)
          cancellation_fee: number | null; // O7 (D45): euro basis at cancel — MANUAL settle
          cancellation_reason: string | null; // O7
          pooled_at: string | null; // O7: PDP climb origin for a RE-POOLED mission
          no_show: boolean; // O7: Guest didn't show → Driver paid like a completed mission
          no_show_at: string | null; // O7
        };
        Insert: {
          id?: string;
          business_id: string;
          dispatcher_id: string;
          driver_id?: string | null;
          status?: MissionStatus;
          mission_type?: MissionType;
          group_id?: string | null;
          category: VehicleCategory;
          zone?: string | null;
          pickup_address: string;
          pickup_lat?: number | null;
          pickup_lng?: number | null;
          dropoff_address?: string | null;
          dropoff_lat?: number | null;
          dropoff_lng?: number | null;
          pickup_label?: string | null;
          dropoff_label?: string | null;
          waypoints?: Json | null;
          stops_reached?: number;
          pickup_at: string;
          flight_number?: string | null;
          flight_eta?: string | null;
          passenger_name?: string | null;
          passenger_names?: Json | null;
          pax_count?: number | null;
          luggage_count?: number | null;
          luggage_only?: boolean;
          comment?: string | null;
          reference?: string | null;
          base_fare?: number | null;
          ceiling: number;
          pdp_start?: number | null;
          pdp_step?: number | null;
          pdp_interval?: number | null;
          speed_win?: boolean;
          required_body_type?: BodyType | null;
          required_make?: string | null;
          required_model?: string | null;
          required_languages?: string[] | null;
          dress_code?: string | null;
          driver_flags?: Json | null;
          board_name?: string | null;
          board_file_path?: string | null;
          driver_message?: string | null;
          distance_km?: number | null;
          duration_min?: number | null;
          cancelled_by?: CancellationParty | null;
          cancelled_at?: string | null;
          created_at?: string;
          accepted_at?: string | null;
          confirmed_at?: string | null;
          info_edited_at?: string | null;
          cancellation_fee?: number | null;
          cancellation_reason?: string | null;
          pooled_at?: string | null;
          no_show?: boolean;
          no_show_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["mission"]["Insert"]>;
        Relationships: [];
      };
      mission_cancellation: {
        Row: {
          id: string;
          mission_id: string;
          business_id: string;
          party: CancellationParty;
          actor_driver_id: string | null;
          kind: "driver_cancel" | "business_cancel" | "no_show" | "t60_reclaim";
          reason: string | null;
          fee_pct: number | null;
          fee_amount: number | null;
          fare_snapshot: number | null;
          hours_before_pickup: number | null;
          resulted_in: "repooled" | "terminal";
          created_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          business_id: string;
          party: CancellationParty;
          actor_driver_id?: string | null;
          kind: "driver_cancel" | "business_cancel" | "no_show" | "t60_reclaim";
          reason?: string | null;
          fee_pct?: number | null;
          fee_amount?: number | null;
          fare_snapshot?: number | null;
          hours_before_pickup?: number | null;
          resulted_in: "repooled" | "terminal";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mission_cancellation"]["Insert"]>;
        Relationships: [];
      };
      mission_guest_contact: {
        Row: {
          mission_id: string;
          contacts: Json;
          updated_at: string;
        };
        Insert: {
          mission_id: string;
          contacts?: Json;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["mission_guest_contact"]["Insert"]
        >;
        Relationships: [];
      };
      // Phase-2 mission edit (D39): a proposed change to an ACCEPTED mission's
      // route + fare, awaiting the assigned Driver's consent. The audit trail; the
      // atomic apply is the respond_to_amendment RPC. (2026-07-07 migration.)
      mission_amendment: {
        Row: {
          id: string;
          mission_id: string;
          business_id: string;
          proposed_by: string | null;
          status: AmendmentStatus;
          new_pickup_address: string;
          new_pickup_lat: number | null;
          new_pickup_lng: number | null;
          new_pickup_label: string | null;
          new_dropoff_address: string | null;
          new_dropoff_lat: number | null;
          new_dropoff_lng: number | null;
          new_dropoff_label: string | null;
          new_waypoints: Json | null;
          new_distance_km: number | null;
          new_duration_min: number | null;
          new_fare: number;
          from_snapshot: Json;
          note: string | null;
          decline_reason: string | null;
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          mission_id: string;
          business_id: string;
          proposed_by?: string | null;
          status?: AmendmentStatus;
          new_pickup_address: string;
          new_pickup_lat?: number | null;
          new_pickup_lng?: number | null;
          new_pickup_label?: string | null;
          new_dropoff_address?: string | null;
          new_dropoff_lat?: number | null;
          new_dropoff_lng?: number | null;
          new_dropoff_label?: string | null;
          new_waypoints?: Json | null;
          new_distance_km?: number | null;
          new_duration_min?: number | null;
          new_fare: number;
          from_snapshot: Json;
          note?: string | null;
          decline_reason?: string | null;
          created_at?: string;
          responded_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["mission_amendment"]["Insert"]>;
        Relationships: [];
      };
      // Detail-edit change-log (D40 follow-up): one row per "Edit details" save,
      // recording WHAT info changed (human phrases). Business-private side table —
      // Drivers have no RLS policy on it. (2026-07-10 migration.)
      mission_info_change: {
        Row: {
          id: string;
          mission_id: string;
          business_id: string;
          edited_by: string | null;
          items: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          business_id: string;
          edited_by?: string | null;
          items?: Json;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["mission_info_change"]["Insert"]
        >;
        Relationships: [];
      };
      status_event: {
        Row: {
          id: string;
          mission_id: string;
          status: StatusEventStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          status: StatusEventStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["status_event"]["Insert"]>;
        Relationships: [];
      };
      payment: {
        Row: {
          id: string;
          mission_id: string;
          stripe_payment_intent_id: string | null;
          amount: number | null;
          status: PaymentStatus;
          captured_at: string | null;
        };
        Insert: {
          id?: string;
          mission_id: string;
          stripe_payment_intent_id?: string | null;
          amount?: number | null;
          status?: PaymentStatus;
          captured_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payment"]["Insert"]>;
        Relationships: [];
      };
      ledger_transaction: {
        Row: {
          id: string;
          mission_id: string;
          gross_fare: number;
          commission_pct: number;
          commission_amount: number;
          driver_net: number;
          currency: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          gross_fare: number;
          commission_pct: number;
          commission_amount: number;
          driver_net: number;
          currency?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ledger_transaction"]["Insert"]>;
        Relationships: [];
      };
      payout: {
        Row: {
          id: string;
          driver_id: string;
          period_start: string;
          period_end: string;
          amount: number;
          status: string;
          stripe_transfer_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          driver_id: string;
          period_start: string;
          period_end: string;
          amount: number;
          status?: string;
          stripe_transfer_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["payout"]["Insert"]>;
        Relationships: [];
      };
      booking_voucher: {
        Row: {
          id: string;
          mission_id: string;
          voucher_number: string;
          pdf_url: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          voucher_number: string;
          pdf_url?: string | null;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["booking_voucher"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      // Atomic accept + slot-conflict + Lock-in, server-side (Doc spine).
      // The Driver PWA calls: rpc('accept_mission', { p_mission_id }).
      accept_mission: {
        Args: { p_mission_id: string };
        Returns: Database["public"]["Tables"]["mission"]["Row"];
      };
      // Driver's consent to a proposed amendment (Phase-2 edit, D39). Atomic +
      // SECURITY DEFINER, like accept_mission. Accept applies the new route+fare;
      // decline leaves the mission untouched. rpc('respond_to_amendment', {...}).
      respond_to_amendment: {
        Args: { p_amendment_id: string; p_accept: boolean; p_reason?: string | null };
        Returns: Database["public"]["Tables"]["mission"]["Row"];
      };
      // O7 cancellation spine (D45). SECURITY DEFINER + atomic, resolving the caller
      // via current_driver_id()/current_business_id(); each returns the mission Row.
      driver_cancel_mission: {
        Args: { p_mission_id: string; p_reason?: string | null; p_fare_snapshot?: number | null };
        Returns: Database["public"]["Tables"]["mission"]["Row"];
      };
      business_cancel_mission: {
        Args: { p_mission_id: string; p_reason?: string | null; p_fare_snapshot?: number | null };
        Returns: Database["public"]["Tables"]["mission"]["Row"];
      };
      reclaim_mission: {
        Args: { p_mission_id: string };
        Returns: Database["public"]["Tables"]["mission"]["Row"];
      };
      mark_no_show: {
        Args: { p_mission_id: string; p_fare_snapshot?: number | null };
        Returns: Database["public"]["Tables"]["mission"]["Row"];
      };
      app_role: { Args: Record<PropertyKey, never>; Returns: UserRole };
      current_driver_id: { Args: Record<PropertyKey, never>; Returns: string };
      current_business_id: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: {
      user_role: UserRole;
      vehicle_category: VehicleCategory;
      body_type: BodyType;
      mission_type: MissionType;
      mission_status: MissionStatus;
      cancellation_party: CancellationParty;
      document_type: DocumentType;
      document_status: DocumentStatus;
      payment_status: PaymentStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

// ---------- Convenience row aliases ----------
export type MissionRow = Database["public"]["Tables"]["mission"]["Row"];
export type MissionAmendmentRow = Database["public"]["Tables"]["mission_amendment"]["Row"];
export type MissionInfoChangeRow = Database["public"]["Tables"]["mission_info_change"]["Row"];
export type MissionCancellationRow = Database["public"]["Tables"]["mission_cancellation"]["Row"];
export type DriverRow = Database["public"]["Tables"]["driver"]["Row"];
export type VehicleRow = Database["public"]["Tables"]["vehicle"]["Row"];
export type DispatcherRow = Database["public"]["Tables"]["dispatcher"]["Row"];
export type BusinessRow = Database["public"]["Tables"]["business"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profile"]["Row"];
