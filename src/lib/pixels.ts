// Pixels → Profiles → Accounts registry.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Pixel = { id: string; name: string; created_at: string };
export type PixelProfile = { id: string; pixel_id: string; name: string; created_at: string };
export type PixelProfileAccount = { id: string; profile_id: string; account_id: string; created_at: string };

export function usePixels() {
  return useQuery({
    queryKey: ["pixels"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pixels").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Pixel[];
    },
    staleTime: 60_000,
  });
}

export function usePixelProfiles() {
  return useQuery({
    queryKey: ["pixel_profiles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pixel_profiles").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as PixelProfile[];
    },
    staleTime: 60_000,
  });
}

export function usePixelProfileAccounts() {
  return useQuery({
    queryKey: ["pixel_profile_accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("pixel_profile_accounts").select("*");
      if (error) throw error;
      return (data ?? []) as PixelProfileAccount[];
    },
    staleTime: 60_000,
  });
}

export type PixelAssignment = { pixelId: string; pixelName: string; profileId: string; profileName: string; label: string };

/** account_id → "Pixel 1 → Profile 2" */
export function usePixelAssignments(): Map<string, PixelAssignment> {
  const { data: pixels = [] } = usePixels();
  const { data: profiles = [] } = usePixelProfiles();
  const { data: links = [] } = usePixelProfileAccounts();

  return useMemo(() => {
    const pixelById = new Map(pixels.map((p) => [p.id, p]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const map = new Map<string, PixelAssignment>();
    for (const l of links) {
      const prof = profileById.get(l.profile_id);
      if (!prof) continue;
      const px = pixelById.get(prof.pixel_id);
      if (!px) continue;
      map.set(l.account_id, {
        pixelId: px.id, pixelName: px.name,
        profileId: prof.id, profileName: prof.name,
        label: `${px.name} → ${prof.name}`,
      });
    }
    return map;
  }, [pixels, profiles, links]);
}

export function useInvalidatePixels() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["pixels"] });
    qc.invalidateQueries({ queryKey: ["pixel_profiles"] });
    qc.invalidateQueries({ queryKey: ["pixel_profile_accounts"] });
  };
}
