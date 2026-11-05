package com.glorian.music;

/** Minimal smoke without JUnit dependency. */
public final class CamelotTransitionSmoke {
  public static void main(String[] args) {
    CamelotTransition same = CamelotTransition.evaluate(0, 1, 0, 1);
    expect(same.compatible && same.relationship == CamelotTransition.Relationship.PERFECT_MATCH, "perfect");

    CamelotTransition mode = CamelotTransition.evaluate(0, 1, 0, 0);
    // 0 major=8B, 0 minor=5A — may be dissonant; just ensure non-null
    expect(mode.camelotA != null && mode.camelotB != null, "labels");

    CamelotTransition neighbor = CamelotTransition.evaluate(7, 1, 2, 1);
    // 7maj=9B, 2maj=10B → ENERGY_BOOST adjacent
    expect(neighbor.compatible, "neighbor compatible");

    System.out.println("CamelotTransitionSmoke PASS");
  }

  private static void expect(boolean cond, String label) {
    if (!cond) {
      throw new IllegalStateException("FAIL " + label);
    }
  }
}
