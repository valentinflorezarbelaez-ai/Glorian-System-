package com.glorian.authz;

/**
 * Smoke tests for AuthZ PermissionGate (javac + java, no Maven required).
 */
public final class PermissionGateSmoke {
  private static int failures = 0;

  public static void main(String[] args) {
    expectAllow(
        PermissionGate.decide(
            PermissionGate.PrincipalKind.CREATOR,
            "artist_42",
            "manage_team",
            "creator:artist_42:team"));
    expectDeny(
        PermissionGate.decide(
            PermissionGate.PrincipalKind.ANONYMOUS, "anon", "read_profile", "creator:artist_42:profile"));
    expectDeny(
        PermissionGate.decide(
            PermissionGate.PrincipalKind.PARTNER,
            "label_9",
            "read_profile",
            "creator:artist_42:profile"));
    expectAllow(
        PermissionGate.decide(
            PermissionGate.PrincipalKind.PARTNER,
            "label_9",
            "read_profile",
            "catalog:public:metadata"));
    expectDeny(
        PermissionGate.decide(
            PermissionGate.PrincipalKind.AGENT,
            "agent_bot",
            "manage_team",
            "creator:agent_bot:team"));
    expectAllow(
        PermissionGate.decide(
            PermissionGate.PrincipalKind.TEAM_MEMBER,
            "mgr_7",
            "publish_release",
            "creator:mgr_7:release"));

    if (failures > 0) {
      System.err.println("PermissionGateSmoke FAILED count=" + failures);
      System.exit(1);
    }
    System.out.println("PermissionGateSmoke PASS");
  }

  private static void expectAllow(PermissionDecision d) {
    if (!d.allowed()) {
      failures++;
      System.err.println("expected ALLOW got DENY reason=" + d.reason());
    }
  }

  private static void expectDeny(PermissionDecision d) {
    if (d.allowed()) {
      failures++;
      System.err.println("expected DENY got ALLOW action=" + d.action());
    }
  }
}
