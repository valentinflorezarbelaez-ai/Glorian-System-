# Java Music Expression Lab (hire-signal practice)
<!-- WITHIN_TESTED_SCOPE — not Spotify production · not Level-5 -->

Parallel JVM practice for Spotify **Music Expression / Platform** backend bar.

## Goal

Transfer Glorian hexagonal + Camelot harmonic craft into **Java** services you can discuss in interview:

- Pure domain module (no Spring required for v0)
- Camelot-compatible transition evaluator (mirrors `EosSpotifyCodex.evaluateHarmonicTransition`)
- JUnit-style tests runnable with `javac` + a minimal test main if Maven absent

## Layout

```
labs/java-music-expression/
  README.md
  src/main/java/com/glorian/music/CamelotTransition.java
  src/main/java/com/glorian/music/CamelotWheel.java
  src/test/java/com/glorian/music/CamelotTransitionSmoke.java
```

## Run (no Maven required)

```bash
cd labs/java-music-expression
javac -d out src/main/java/com/glorian/music/*.java src/test/java/com/glorian/music/*.java
java -cp out com.glorian.music.CamelotTransitionSmoke
```

## Trace

- North Star: `docs/governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md`
- Octaves method: `docs/governance/HOW_WE_IMPROVE_SPOTIFY_WITH_OCTAVES.md`
- Codex twin: `src/core/eosSpotifyCodex.ts`
