# wow-addon-icons

Themed icons for addon groups. Each one is a Font Awesome Pro (Regular) or game-icons.net glyph on a gold-framed tile tinted per group. They export in bulk to PNG.

## Export

```sh
pnpm export                          # all groups → dist/{150,256,512}/<slug>.png + dist/svg + dist/preview.html
pnpm export --only gamepad,questing  # selected groups
pnpm export --sizes 150,400          # custom sizes (minimum 150)
```

## Add a group

Add one entry to `ICON_GROUPS` in `src/icon-groups.ts`:

```ts
{ slug: 'raid-tools', label: 'Raid Tools', glyph: fromFontAwesome(faShieldHalved), hue: 210 },
{ slug: 'professions', label: 'Professions', glyph: gameIcon('anvil-impact'), hue: 20 },
```

Glyphs come from two sources, both adapted in `src/glyph.ts`:

- `fromFontAwesome(fa*)` takes an icon from `@fortawesome/pro-regular-svg-icons`, by its camelCase `fa*` name.
- `gameIcon('slug')` takes an icon from [game-icons.net](https://game-icons.net) by its slug. These are RPG and fantasy silhouettes. An unknown slug throws.

`hue` (0–360) tints the background.

## Change the theme

Theme tokens (border golds, glyph colours, corner radii, glyph scale) live in `src/theme.ts`. Each group's background gradient comes from its hue via `deriveGroupPalette`.

## Font Awesome Pro

The Pro packages install from tarballs in `vendor/`. They're packed from a licensed local install because the token in `~/.npmrc` returned 401. `vendor/` is gitignored. Keep it out of any public repo. Once the token works, swap the `file:` dependencies (and the override in `pnpm-workspace.yaml`) back to normal version ranges.

## game-icons.net licence

game-icons.net icons are by Lorc, Delapouite and contributors, under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). Any icon set you ship with one of them must credit game-icons.net, for example in the addon's README or credits. `dist/preview.html` carries the credit.

## Checks

```sh
pnpm typecheck && pnpm test && pnpm lint
```
