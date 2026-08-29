{
  description = "Imposteur anime — jeux multijoueurs en ligne (Node.js)";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs }:
    let
      systems = [ "x86_64-linux" "aarch64-linux" ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f (nixpkgs.legacyPackages.${system}));
      nodejs = pkgs: pkgs.nodejs_22;
    in
    {
      packages = forAllSystems (pkgs:
        let
          node = nodejs pkgs;
        in
        {
          default = pkgs.buildNpmPackage {
            pname = "imposteur-anime";
            version = "1.0.0";
            src = ./.;
            nodejs = node;
            # Premier build : mettre un hash bidon, lancer `nix build .`, puis remplacer
            # par le hash affiché dans l'erreur. (`nix flake lock` génère flake.lock.)
            npmDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
            dontNpmBuild = true;
            installPhase = ''
              runHook preInstall
              mkdir -p $out/lib/node_modules/${pname}
              cp -r . $out/lib/node_modules/${pname}/
              rm -rf $out/lib/node_modules/${pname}/node_modules/.cache
              mkdir -p $out/bin
              cat > $out/bin/imposteur-anime <<EOF
              #!${pkgs.runtimeShell}
              exec ${node}/bin/node $out/lib/node_modules/${pname}/server.js
              EOF
              chmod +x $out/bin/imposteur-anime
              runHook postInstall
            '';
            meta = with pkgs.lib; {
              description = "Jeu de l'imposteur et enchères sur personnages d'anime";
              license = licenses.mit;
              mainProgram = "imposteur-anime";
            };
          };
        });

      devShells = forAllSystems (pkgs:
        let
          node = nodejs pkgs;
        in
        {
          default = pkgs.mkShell {
            buildInputs = [ node pkgs.nodePackages.npm ];
            shellHook = ''
              echo "Imposteur anime — shell de dev Node.js $(node --version)"
              echo "Lancement : npm start"
            '';
          };
        });
    };
}