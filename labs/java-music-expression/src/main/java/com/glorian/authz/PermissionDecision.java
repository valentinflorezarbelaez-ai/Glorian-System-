package com.glorian.authz;

/**
 * Fail-closed AuthZ decision for Spotify Platform hire-signal practice.
 * WITHIN_TESTED_SCOPE — not Spotify production Authorization service.
 */
public final class PermissionDecision {
  public enum Effect {
    ALLOW,
    DENY
  }

  private final Effect effect;
  private final String principalId;
  private final String action;
  private final String resource;
  private final String reason;

  public PermissionDecision(
      Effect effect, String principalId, String action, String resource, String reason) {
    if (effect == null) {
      throw new IllegalArgumentException("effect required");
    }
    this.effect = effect;
    this.principalId = requireToken(principalId, "principalId");
    this.action = requireToken(action, "action");
    this.resource = requireToken(resource, "resource");
    this.reason = reason == null || reason.isBlank() ? "unspecified" : reason.trim();
  }

  private static String requireToken(String value, String field) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(field + " required");
    }
    return value.trim();
  }

  public Effect effect() {
    return effect;
  }

  public boolean allowed() {
    return effect == Effect.ALLOW;
  }

  public String principalId() {
    return principalId;
  }

  public String action() {
    return action;
  }

  public String resource() {
    return resource;
  }

  public String reason() {
    return reason;
  }
}
