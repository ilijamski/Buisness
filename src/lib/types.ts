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

export type Company = {
  id: string;
  name: string;
  join_code: string;
  reminder_lead_days: number;
  contact_email: string | null;
  contact_address: string | null;
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
        Insert: Omit<Entry, "id" | "created_at"> & { id?: string };
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
      user_settings: Table<{
        user_id: string;
        theme: "light" | "dark" | "system";
        email_reminders: boolean;
        default_trip_type: TripType;
        compact_lists: boolean;
        updated_at: string;
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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
