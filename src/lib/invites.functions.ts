import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RoleEnum = z.enum(["owner", "production", "creative", "va", "chatter"]);

async function assertOwner(supabase: any, userId: string) {
  const { data, error } = await supabase.from("profiles").select("role").eq("id", userId).single();
  if (error) throw new Error(error.message);
  if (data?.role !== "owner") throw new Error("Только владелец может управлять приглашениями");
}

/**
 * Invite a team member by id + email.
 * Stamps invited_at/invite_email on the team_member row, creates the auth user
 * (or reuses an existing pending one), and returns a copy-able invite link.
 * Supabase will also attempt to send a default invitation email; if no SMTP
 * is configured, just share the returned link manually.
 */
export const inviteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({
      team_member_id: z.string().uuid(),
      email: z.string().email(),
      role: RoleEnum,
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tm, error: tmErr } = await supabaseAdmin
      .from("team_members").select("*").eq("id", data.team_member_id).single();
    if (tmErr || !tm) throw new Error("Участник не найден");

    // Check if a user with this email already exists.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list?.users.find((x: any) => x.email?.toLowerCase() === data.email.toLowerCase());

    if (existing) {
      // Link team_member to existing profile and assign new role; no invite email.
      await supabaseAdmin.from("profiles")
        .update({ role: data.role, invited_role: data.role })
        .eq("id", existing.id);
      await supabaseAdmin.from("team_members").update({
        profile_id: existing.id,
        invited_at: null,
        invite_email: null,
      }).eq("id", data.team_member_id);
      return {
        id: existing.id,
        email: existing.email,
        action_link: null as string | null,
        already_existed: true,
      };
    }

    // Generate the invite link (also creates the auth user in invited state).
    const redirectTo = (process.env.SITE_URL || "") + "/auth";
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: data.email,
      options: {
        data: {
          role: data.role,
          full_name: tm.name,
          assignee_name: tm.assignee_name ?? tm.name,
          telegram_handle: tm.telegram_handle ?? null,
        },
        redirectTo: redirectTo || undefined,
      },
    });
    if (linkErr) {
      const { data: invited, error: inviteErr } = await supabaseAdmin.auth.admin
        .inviteUserByEmail(data.email, { data: { role: data.role } });
      if (inviteErr) throw new Error(linkErr.message || inviteErr.message);
      await supabaseAdmin.from("team_members").update({
        invited_at: new Date().toISOString(),
        invite_email: data.email,
      }).eq("id", data.team_member_id);
      return { id: invited.user?.id, email: invited.user?.email, action_link: null as string | null, already_existed: false };
    }

    await supabaseAdmin.from("team_members").update({
      invited_at: new Date().toISOString(),
      invite_email: data.email,
    }).eq("id", data.team_member_id);

    return {
      id: link.user?.id,
      email: data.email,
      action_link: link.properties?.action_link ?? null,
      already_existed: false,
    };
  });

/** Cancel a pending invite — clears stamps and deletes the unregistered auth user. */
export const cancelTeamInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ team_member_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tm } = await supabaseAdmin
      .from("team_members").select("invite_email, profile_id").eq("id", data.team_member_id).single();

    if (tm?.invite_email && !tm.profile_id) {
      // Find auth user by email and delete if still unregistered.
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      const u = list?.users.find((x: any) => x.email?.toLowerCase() === tm.invite_email!.toLowerCase());
      if (u && !u.last_sign_in_at) {
        await supabaseAdmin.auth.admin.deleteUser(u.id);
      }
    }

    await supabaseAdmin.from("team_members").update({
      invited_at: null, invite_email: null,
    }).eq("id", data.team_member_id);

    return { ok: true };
  });

/** Revoke a registered user's access: delete profile + auth user, keep team_member. */
export const revokeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ team_member_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tm } = await supabaseAdmin
      .from("team_members").select("profile_id").eq("id", data.team_member_id).single();
    if (!tm?.profile_id) throw new Error("Нет привязанного аккаунта");
    if (tm.profile_id === context.userId) throw new Error("Нельзя удалить свой доступ");

    await supabaseAdmin.from("team_members").update({
      profile_id: null, invited_at: null, invite_email: null,
    }).eq("id", data.team_member_id);
    await supabaseAdmin.from("profiles").delete().eq("id", tm.profile_id);
    await supabaseAdmin.auth.admin.deleteUser(tm.profile_id);

    return { ok: true };
  });

/** Delete a team member entirely (and any linked profile/auth user). */
export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ team_member_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tm } = await supabaseAdmin
      .from("team_members").select("profile_id, invite_email").eq("id", data.team_member_id).single();

    if (tm?.profile_id) {
      if (tm.profile_id === context.userId) throw new Error("Нельзя удалить себя");
      await supabaseAdmin.from("profiles").delete().eq("id", tm.profile_id);
      await supabaseAdmin.auth.admin.deleteUser(tm.profile_id);
    } else if (tm?.invite_email) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      const u = list?.users.find((x: any) => x.email?.toLowerCase() === tm.invite_email!.toLowerCase());
      if (u && !u.last_sign_in_at) await supabaseAdmin.auth.admin.deleteUser(u.id);
    }

    await supabaseAdmin.from("team_members").delete().eq("id", data.team_member_id);
    return { ok: true };
  });

/** Remove a team_member row only. Unlinks profile_id but keeps the profile and auth user. */
export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ team_member_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: tm } = await supabaseAdmin
      .from("team_members").select("profile_id").eq("id", data.team_member_id).single();

    if (tm?.profile_id && tm.profile_id === context.userId) {
      throw new Error("Нельзя удалить свою запись");
    }
    if (tm?.profile_id) {
      await supabaseAdmin.from("team_members")
        .update({ profile_id: null, invited_at: null, invite_email: null })
        .eq("id", data.team_member_id);
    }
    await supabaseAdmin.from("team_members").delete().eq("id", data.team_member_id);
    return { ok: true };
  });

/** Approve a pending member — sets profile.status = 'active'. */
export const approveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ profile_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ status: "active" }).eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Reject a pending member — sets profile.status = 'rejected'. */
export const rejectMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ profile_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    if (data.profile_id === context.userId) throw new Error("Нельзя отклонить себя");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ status: "rejected" }).eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Change a profile's role. */
export const setProfileRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ profile_id: z.string().uuid(), role: RoleEnum }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles")
      .update({ role: data.role, invited_role: data.role }).eq("id", data.profile_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Delete a profile + auth user. Also unlinks any team_members row. */
export const deleteProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ profile_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    if (data.profile_id === context.userId) throw new Error("Нельзя удалить себя");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_members").update({ profile_id: null }).eq("profile_id", data.profile_id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.profile_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.profile_id);
    if (error && !/not found/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

// ─── Legacy compatibility (kept so older imports don't break) ──────────────

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ email: z.string().email(), role: RoleEnum }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invited, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { role: data.role },
    });
    if (error) throw new Error(error.message);
    return { id: invited.user?.id, email: invited.user?.email };
  });

export const listInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("team_members")
      .select("id, name, invite_email, invited_at, role_label")
      .not("invited_at", "is", null)
      .is("profile_id", null);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id, email: r.invite_email, invited_at: r.invited_at, role: r.role_label,
    }));
  });

export const cancelInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_members").update({
      invited_at: null, invite_email: null,
    }).eq("id", data.id);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("Нельзя удалить себя");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("team_members").update({ profile_id: null }).eq("profile_id", data.id);
    await supabaseAdmin.from("profiles").delete().eq("id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
