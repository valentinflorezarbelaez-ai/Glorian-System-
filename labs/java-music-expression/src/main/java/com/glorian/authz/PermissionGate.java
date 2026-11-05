package com.glorian.authz;

import java.util.Locale;
import java.util.Objects;
import java.util.Set;

/**
 * Least-privilege gate for creator / team / partner / agent principals.
 * Mirrors Spotify Authorization Platform product language for interview craft.
 * WITHIN_TESTED_SCOPE practice lab — not Spotify production.
 */
public final class PermissionGate {
  public enum PrincipalKind {
    CREATOR,
    TEAM_MEMBER,
    PARTNER,
    AGENT,
    ANONYMOUS
  }

  private static final Set<String> CREATOR_ACTIONS =
      Set.of("read_profile", "edit_profile", "manage_team", "publish_release");
  private static final Set<String> TEAM_ACTIONS =
      Set.of("read_profile", "edit_profile", "publish_release");
  private static final Set<String> PARTNER_ACTIONS = Set.of("read_profile");
  private static final Set<String> AGENT_ACTIONS = Set.of("read_profile", "edit_profile");

  private PermissionGate() {}

  public static PermissionDecision decide(
      PrincipalKind kind, String principalId, String action, String resource) {
    Objects.requireNonNull(kind, "kind");
    String act = action == null ? "" : action.trim().toLowerCase(Locale.ROOT);
    String res = resource == null ? "" : resource.trim();
    String pid = principalId == null ? "" : principalId.trim();

    if (pid.isEmpty() || act.isEmpty() || res.isEmpty()) {
      return new PermissionDecision(
          PermissionDecision.Effect.DENY, pid.isEmpty() ? "unknown" : pid, act.isEmpty() ? "unknown" : act,
          res.isEmpty() ? "unknown" : res, "missing_principal_action_or_resource");
    }

    if (kind == PrincipalKind.ANONYMOUS) {
      return new PermissionDecision(
          PermissionDecision.Effect.DENY, pid, act, res, "anonymous_fail_closed");
    }

    if (!resourceOwnedByPrincipal(pid, res) && kind != PrincipalKind.PARTNER) {
      return new PermissionDecision(
          PermissionDecision.Effect.DENY, pid, act, res, "resource_outside_principal_scope");
    }

    Set<String> allowed =
        switch (kind) {
          case CREATOR -> CREATOR_ACTIONS;
          case TEAM_MEMBER -> TEAM_ACTIONS;
          case PARTNER -> PARTNER_ACTIONS;
          case AGENT -> AGENT_ACTIONS;
          case ANONYMOUS -> Set.of();
        };

    if (!allowed.contains(act)) {
      return new PermissionDecision(
          PermissionDecision.Effect.DENY, pid, act, res, "action_not_in_role_allowlist");
    }

    if (kind == PrincipalKind.PARTNER && !res.startsWith("catalog:public:")) {
      return new PermissionDecision(
          PermissionDecision.Effect.DENY, pid, act, res, "partner_limited_to_public_catalog");
    }

    if (kind == PrincipalKind.AGENT && act.equals("manage_team")) {
      return new PermissionDecision(
          PermissionDecision.Effect.DENY, pid, act, res, "agent_cannot_manage_team");
    }

    return new PermissionDecision(
        PermissionDecision.Effect.ALLOW, pid, act, res, "least_privilege_allow");
  }

  /** Resource form: creator:{principalId}:* or catalog:public:* */
  static boolean resourceOwnedByPrincipal(String principalId, String resource) {
    if (resource.startsWith("catalog:public:")) {
      return true;
    }
    String prefix = "creator:" + principalId + ":";
    return resource.startsWith(prefix);
  }
}
