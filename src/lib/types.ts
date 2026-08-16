export type Role = "mitarbeiter" | "admin";

export type EntryType =
  | "tanken"
  | "wartung"
  | "schaden"
  | "reifen"
  | "bremsen"
  | "inspektion"
  | "sonstiges";

export type TripType = "dienstlich" | "privat" | "arbeitsweg";

export type DocumentKind =
  | "fahrzeugschein"
  | "fahrzeugbrief"
  | "versicherung"
  | "leasingvertrag"
  | "nachweis"
  | "sonstiges";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

export type Company = {
  id: string;
  name: string;
  join_code: string;
  reminder_lead_days: number;
  contact_email: string | null;
  contact_address: string | null;
  subscription_status: SubscriptionStatus;
  plan: "monthly" | "yearly" | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  /** Erste Freischaltung (Abo oder Testcode). Leer = noch nie freigeschaltet. */
  activated_at: string | null;
  created_at: string;
};

/** Aggregierte Kennzahlen für den Betreiber (siehe platform_stats()). */
export type PlatformStats = {
  companies_total: number;
  companies_paying: number;
  companies_trialing: number;
  companies_past_due: number;
  companies_expired: number;
  companies_canceling: number;
  new_companies_30d: number;
  new_companies_prev30d: number;
  plan_monthly: number;
  plan_yearly: number;
  mrr_gross_cents: number;
  mrr_net_cents: number;
  arr_gross_cents: number;
  arr_net_cents: number;
  users_total: number;
  vehicles_total: number;
  codes_redeemed: number;
};

export type PlatformCompany = {
  id: string;
  name: string;
  subscription_status: SubscriptionStatus;
  plan: "monthly" | "yearly" | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_access: boolean;
  user_count: number;
  vehicle_count: number;
  created_at: string;
};

export type PromoCode = {
  code: string;
  grants_days: number;
  max_uses: number;
  used_count: number;
  note: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  company_id: string | null;
  employee_number: number | null;
  license_classes: string | null;
  license_expires_on: string | null;
  active: boolean;
  created_at: string;
};

export type Vehicle = {
  id: string;
  company_id: string | null;
  vehicle_number: number | null;
  name: string;
  plate: string;
  type: string | null;
  vin: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;

  // Fristen & Prüfungen
  tuv_date: string | null;
  hu_date: string | null;
  au_date: string | null;
  uvv_date: string | null;
  tachograph_date: string | null;
  insurance_company: string | null;
  insurance_policy_number: string | null;
  insurance_expires_on: string | null;
  registration_date: string | null;
  season_plate_from: string | null;
  season_plate_to: string | null;

  // Wartung & Technik
  current_mileage: number | null;
  mileage_updated_at: string | null;
  next_service_date: string | null;
  next_service_mileage: number | null;
  next_tire_change_date: string | null;
  tire_type: string | null;
  tread_depth_mm: number | null;
  next_brake_check_date: string | null;

  // Finanzen & Verwaltung
  leasing_provider: string | null;
  leasing_end_date: string | null;
  leasing_monthly_cost: number | null;
  tax_due_date: string | null;
  tax_amount: number | null;
  purchase_value: number | null;
  purchase_date: string | null;
  residual_value: number | null;
};

export type Entry = {
  id: string;
  vehicle_id: string;
  type: EntryType;
  cost: number;
  note: string | null;
  date: string;
  author_id: string;
  receipt_path: string | null;
  /** Getankte Menge in Litern; Grundlage für Verbrauch und CO2. */
  liters: number | null;
  fuel_type: string | null;
  /** Zählerstand beim Tanken — für die Strecke zwischen zwei Füllungen. */
  mileage: number | null;
  created_at: string;
};

export type EntryWithVehicle = Entry & {
  vehicles: Pick<Vehicle, "id" | "name" | "plate"> | null;
};

export type VehicleAssignment = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  started_on: string;
  ended_on: string | null;
  created_at: string;
};

export type AssignmentWithDriver = VehicleAssignment & {
  profiles: Pick<Profile, "id" | "full_name" | "email" | "employee_number"> | null;
};

export type LogbookEntry = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  date: string;
  start_mileage: number;
  end_mileage: number;
  trip_type: TripType;
  start_location: string | null;
  end_location: string | null;
  purpose: string | null;
  created_at: string;
};

export type WorkshopRecord = {
  id: string;
  vehicle_id: string;
  date: string;
  workshop: string | null;
  description: string;
  mileage: number | null;
  cost: number;
  invoice_path: string | null;
  created_by: string | null;
  created_at: string;
};

export type FuelCard = {
  id: string;
  company_id: string;
  provider: string;
  card_number: string;
  pin_hint: string | null;
  vehicle_id: string | null;
  valid_until: string | null;
  created_at: string;
};

export type VehicleDocument = {
  id: string;
  vehicle_id: string;
  kind: DocumentKind;
  title: string;
  file_path: string;
  valid_until: string | null;
  uploaded_by: string | null;
  created_at: string;
};

// --- Fahrzeugcheck, Mängel, Aufträge ---------------------------------------

/** Ein Punkt auf der Checkliste. `critical` = Mangel legt das Fahrzeug still. */
export type CheckItem = {
  key: string;
  label: string;
  critical: boolean;
};

export type CheckTemplate = {
  id: string;
  company_id: string;
  name: string;
  items: CheckItem[];
  is_default: boolean;
  active: boolean;
  created_at: string;
};

export type CheckResultStatus = "ok" | "mangel" | "entfaellt";
export type CheckOutcome = "ok" | "maengel" | "stillgelegt";

export type VehicleCheck = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  template_id: string | null;
  performed_at: string;
  mileage: number | null;
  result: CheckOutcome;
  note: string | null;
  created_at: string;
};

export type CheckResult = {
  id: string;
  check_id: string;
  item_key: string;
  label: string;
  status: CheckResultStatus;
  note: string | null;
  photo_path: string | null;
  created_at: string;
};

export type CheckWithDriver = VehicleCheck & {
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
  vehicles: Pick<Vehicle, "id" | "name" | "plate"> | null;
};

export type DefectSeverity = "gering" | "mittel" | "kritisch";
export type DefectStatus = "offen" | "in_arbeit" | "erledigt" | "verworfen";

export type Defect = {
  id: string;
  vehicle_id: string;
  reported_by: string | null;
  check_id: string | null;
  title: string;
  description: string | null;
  severity: DefectSeverity;
  status: DefectStatus;
  photo_path: string | null;
  due_date: string | null;
  assigned_to: string | null;
  resolved_at: string | null;
  resolution: string | null;
  cost: number | null;
  created_at: string;
};

export type DefectWithContext = Defect & {
  vehicles: Pick<Vehicle, "id" | "name" | "plate"> | null;
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type JobStatus = "geplant" | "unterwegs" | "erledigt" | "abgebrochen";

export type Job = {
  id: string;
  company_id: string;
  vehicle_id: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  address: string | null;
  scheduled_for: string | null;
  status: JobStatus;
  completed_at: string | null;
  driver_note: string | null;
  created_by: string | null;
  created_at: string;
};

export type JobWithContext = Job & {
  vehicles: Pick<Vehicle, "id" | "name" | "plate"> | null;
  profiles: Pick<Profile, "id" | "full_name" | "email"> | null;
};

export type CompanyModuleSetting = {
  company_id: string;
  module_key: string;
  enabled: boolean;
  required: boolean;
};

export type VehicleModuleSetting = {
  vehicle_id: string;
  module_key: string;
  enabled: boolean | null;
  required: boolean | null;
};

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      companies: Table<Company, Omit<Company, "id" | "created_at" | "join_code"> & { join_code?: string }>;
      profiles: Table<Profile, Partial<Profile> & { id: string; email: string }>;
      vehicles: Table<Vehicle, Partial<Vehicle> & { name: string; plate: string }>;
      entries: {
        Row: Entry;
        // liters/fuel_type/mileage sind optional: sie kommen erst mit
        // Migration 0017, und das Erfassen muss auch davor funktionieren.
        Insert: Omit<Entry, "id" | "created_at" | "liters" | "fuel_type" | "mileage"> & {
          id?: string;
          liters?: number | null;
          fuel_type?: string | null;
          mileage?: number | null;
        };
        Update: Partial<Omit<Entry, "id" | "created_at">>;
        Relationships: [
          {
            foreignKeyName: "entries_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_assignments: {
        Row: VehicleAssignment;
        Insert: Omit<VehicleAssignment, "id" | "created_at" | "started_on" | "ended_on"> & {
          started_on?: string;
          ended_on?: string | null;
        };
        Update: Partial<VehicleAssignment>;
        Relationships: [
          {
            foreignKeyName: "vehicle_assignments_driver_id_fkey";
            columns: ["driver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      logbook_entries: Table<
        LogbookEntry,
        Omit<LogbookEntry, "id" | "created_at"> & { id?: string }
      >;
      workshop_records: Table<
        WorkshopRecord,
        Omit<WorkshopRecord, "id" | "created_at"> & { id?: string }
      >;
      fuel_cards: Table<FuelCard, Omit<FuelCard, "id" | "created_at"> & { id?: string }>;
      documents: Table<
        VehicleDocument,
        Omit<VehicleDocument, "id" | "created_at"> & { id?: string }
      >;
      company_module_settings: Table<CompanyModuleSetting, CompanyModuleSetting>;
      vehicle_module_settings: Table<VehicleModuleSetting, VehicleModuleSetting>;
      check_templates: Table<
        CheckTemplate,
        Omit<CheckTemplate, "id" | "created_at"> & { id?: string }
      >;
      vehicle_checks: Table<
        VehicleCheck,
        Omit<VehicleCheck, "id" | "created_at" | "performed_at"> & {
          id?: string;
          performed_at?: string;
        }
      >;
      check_results: Table<
        CheckResult,
        Omit<CheckResult, "id" | "created_at"> & { id?: string }
      >;
      // Beim Anlegen sind nur Fahrzeug und Titel Pflicht — Termin, Kosten
      // und Bearbeitungsstand entstehen erst später.
      defects: Table<
        Defect,
        Partial<Defect> & { vehicle_id: string; title: string }
      >;
      jobs: Table<Job, Partial<Job> & { company_id: string; title: string }>;
      user_settings: Table<{
        user_id: string;
        theme: "light" | "dark" | "system";
        email_reminders: boolean;
        default_trip_type: TripType;
        compact_lists: boolean;
        push_reminders: boolean;
        updated_at: string;
      }>;
      promo_codes: Table<PromoCode>;
      promo_redemptions: Table<{
        code: string;
        company_id: string;
        redeemed_by: string | null;
        redeemed_at: string;
      }>;
      platform_admins: Table<{ user_id: string; created_at: string }>;
      push_subscriptions: Table<{
        id: string;
        user_id: string;
        platform: "web" | "ios" | "android";
        endpoint: string;
        p256dh: string | null;
        auth: string | null;
        user_agent: string | null;
        created_at: string;
      }>;
      reminder_log: Table<{
        subject_type: "vehicle" | "profile";
        subject_id: string;
        module_key: string;
        due_date: string;
        sent_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      join_or_create_company: {
        Args: {
          p_company_name: string | null;
          p_join_code: string | null;
          p_full_name: string | null;
        };
        Returns: string;
      };
      can_delete_own_account: {
        Args: Record<string, never>;
        Returns: {
          allowed: boolean;
          reason?: string;
          deletes_company?: boolean;
        };
      };
      set_member_role: {
        Args: { p_profile_id: string; p_role: string };
        Returns: undefined;
      };
      redeem_promo_code: {
        Args: { p_code: string };
        Returns: {
          ok: boolean;
          error?: string;
          days?: number;
          trial_ends_at?: string;
        };
      };
      create_promo_code: {
        Args: {
          p_grants_days: number;
          p_max_uses: number;
          p_note: string | null;
          p_expires_at: string | null;
        };
        Returns: string;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      platform_stats: {
        Args: Record<string, never>;
        Returns: PlatformStats;
      };
      platform_companies: {
        Args: Record<string, never>;
        Returns: PlatformCompany[];
      };
      company_has_access: {
        Args: { p_company_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
