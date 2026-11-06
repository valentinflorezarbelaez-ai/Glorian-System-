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
  src/main/java/com/glorian/music/...
  src/main/java/com/glorian/authz/PermissionGate.java
  src/main/java/com/glorian/authz/PermissionDecision.java
  src/test/java/com/glorian/music/CamelotTransitionSmoke.java
  src/test/java/com/glorian/authz/PermissionGateSmoke.java
```

## Run (JDK required; no Maven)

Requires a local JDK (`javac` / `java` on PATH). If JDK is absent, keep sources as hire-signal artifacts and run smokes when the toolchain is installed.

```bash
cd labs/java-music-expression
javac -d out src/main/java/com/glorian/music/*.java src/main/java/com/glorian/authz/*.java \
  src/test/java/com/glorian/music/*.java src/test/java/com/glorian/authz/*.java
java -cp out com.glorian.music.CamelotTransitionSmoke
java -cp out com.glorian.authz.PermissionGateSmoke
```

## Tracks

| Track | Lab surface | Interview language |
| --- | --- | --- |
| Music Expression | Camelot wheel / transitions | Harmonic UX, artist-first mixes |
| AuthZ Platform | `PermissionGate` fail-closed | Creators, teams, partners, agents · least privilege |

## Trace

- North Star: `docs/governance/GLORIAN_SPOTIFY_ONLY_NORTH_STAR.md`
- Octaves method: `docs/governance/HOW_WE_IMPROVE_SPOTIFY_WITH_OCTAVES.md`
- AuthZ lens: `docs/governance/SPOTIFY_AUTHORIZATION_PLATFORM_LENS.md`
- Golden Paths map: `docs/governance/SPOTIFY_STACK_GOLDEN_PATHS_MAP.md`
- Codex twin: `src/core/eosSpotifyCodex.ts`
