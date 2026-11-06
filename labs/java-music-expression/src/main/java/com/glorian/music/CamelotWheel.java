package com.glorian.music;

/**
 * Camelot wheel helpers mirroring EosSpotifyCodex harmonic mapping.
 * WITHIN_TESTED_SCOPE practice lab — not Spotify production.
 */
public final class CamelotWheel {
  private CamelotWheel() {}

  private static final int[] MAJOR = {8, 3, 10, 5, 12, 7, 2, 9, 4, 11, 6, 1};
  private static final int[] MINOR = {5, 12, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10};

  /** @param key 0..11 pitch class; @param mode 0=minor, 1=major */
  public static String toCamelot(int key, int mode) {
    if (key < 0 || key > 11) {
      throw new IllegalArgumentException("key must be 0..11");
    }
    if (mode != 0 && mode != 1) {
      throw new IllegalArgumentException("mode must be 0 or 1");
    }
    int num = mode == 1 ? MAJOR[key] : MINOR[key];
    char letter = mode == 1 ? 'B' : 'A';
    return num + String.valueOf(letter);
  }
}
