package com.glorian.music;

/**
 * Harmonic transition evaluation for playlist/mix continuity.
 */
public final class CamelotTransition {
  public enum Relationship {
    PERFECT_MATCH,
    ENERGY_BOOST,
    ENERGY_DROP,
    MODE_SHIFT,
    DISSONANT
  }

  public final boolean compatible;
  public final String camelotA;
  public final String camelotB;
  public final Relationship relationship;

  public CamelotTransition(boolean compatible, String camelotA, String camelotB, Relationship relationship) {
    this.compatible = compatible;
    this.camelotA = camelotA;
    this.camelotB = camelotB;
    this.relationship = relationship;
  }

  public static CamelotTransition evaluate(int keyA, int modeA, int keyB, int modeB) {
    String a = CamelotWheel.toCamelot(keyA, modeA);
    String b = CamelotWheel.toCamelot(keyB, modeB);
    if (a.equals(b)) {
      return new CamelotTransition(true, a, b, Relationship.PERFECT_MATCH);
    }
    int numA = Integer.parseInt(a.substring(0, a.length() - 1));
    int numB = Integer.parseInt(b.substring(0, b.length() - 1));
    char letterA = a.charAt(a.length() - 1);
    char letterB = b.charAt(b.length() - 1);
    if (letterA == letterB) {
      int diff = Math.abs(numA - numB);
      if (diff == 1 || diff == 11) {
        boolean boost = numB == (numA % 12) + 1 || (numA == 12 && numB == 1);
        return new CamelotTransition(
            true, a, b, boost ? Relationship.ENERGY_BOOST : Relationship.ENERGY_DROP);
      }
    } else if (numA == numB) {
      return new CamelotTransition(true, a, b, Relationship.MODE_SHIFT);
    }
    return new CamelotTransition(false, a, b, Relationship.DISSONANT);
  }
}
