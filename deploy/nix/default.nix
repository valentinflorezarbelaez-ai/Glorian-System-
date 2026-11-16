{ pkgs ? import <nixpkgs> {} }:

pkgs.stdenv.mkDerivation {
  pname = "glorian-system";
  version = "75.0.0";
  src = ../..;

  nativeBuildInputs = [ pkgs.nodejs_22 pkgs.git ];

  SOURCE_DATE_EPOCH = 1700000000;
  __noChroot = false;

  buildPhase = ''
    node bin/eos.mjs hygiene:audit
  '';

  installPhase = ''
    mkdir -p $out/bin $out/lib/glorian
    cp -r src bin docs $out/lib/glorian/
    ln -s $out/lib/glorian/bin/eos.mjs $out/bin/eos
  '';

  meta = with pkgs.lib; {
    description = "Glorian System Sovereign Control Plane";
    license = licenses.mit;
    platforms = platforms.all;
  };
}
