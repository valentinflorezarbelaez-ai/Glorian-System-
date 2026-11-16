{
  description = "Glorian System — Hermetic Reproducible Build Environment (SPEC-302)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.allowUnfree = false;
        };
      in
      {
        packages.default = pkgs.stdenv.mkDerivation {
          pname = "glorian-system-hermetic";
          version = "75.0.0";
          src = ../..;

          nativeBuildInputs = [ pkgs.nodejs_22 pkgs.git ];

          # Zero network access during compilation
          __noChroot = false;
          outputHashAlgo = "sha256";
          
          # Canonical timestamp normalization
          SOURCE_DATE_EPOCH = 1700000000;

          buildPhase = ''
            export HOME=$TMPDIR
            node --version
            node bin/eos.mjs hygiene:audit
          '';

          installPhase = ''
            mkdir -p $out/lib/glorian
            cp -r src bin docs $out/lib/glorian/
          '';
        };

        devShells.default = pkgs.mkShell {
          buildInputs = [
            pkgs.nodejs_22
            pkgs.git
          ];

          SOURCE_DATE_EPOCH = 1700000000;
          EOS_HERMETIC_BUILD = "1";
        };
      }
    );
}
