export type Role = "mitarbeiter" | "admin";

export type EntryType = "tanken" | "wartung" | "schaden";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  created_at: string;
};

export type Vehicle = {
  id: string;
  name: string;
  plate: string;
  type: string | null;
  tuv_date: string | null;
  created_at: string;
};

export type Entry = {
  id: string;
  vehicle_id: string;
  type: EntryType;
  cost: number;
  note: string | null;
  date: string;
  author_id: string;
  created_at: string;
};

export type EntryWithVehicle = Entry & {
  vehicles: Pick<Vehicle, "id" | "name" | "plate"> | null;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; email: string };
        Update: Partial<Profile>;
        Relationships: [];
      };
      vehicles: {
        Row: Vehicle;
        Insert: Omit<Vehicle, "id" | "created_at"> & { id?: string };
        Update: Partial<Omit<Vehicle, "id" | "created_at">>;
        Relationships: [];
      };
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
