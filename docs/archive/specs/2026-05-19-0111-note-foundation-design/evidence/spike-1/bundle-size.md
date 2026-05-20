# Bundle and install size evidence

## Method

Evidence combines:

- npm registry package unpacked sizes from `npm view <pkg>@<version> dist --json`.
- local installed directory size from `du -sh node_modules/@blocknote node_modules/@mantine ...`.
- Vite production output from `npm run build` in the isolated sandbox.

This is not a full Reo bundle estimate because the sandbox renders both Mantine and bare panels at once and includes Playwright as a dev dependency after screenshot setup. It is sufficient to judge adapter order and lazy-load need.

## Registry package unpacked sizes

```text
@blocknote/core@0.51.1      unpackedSize 7,571,469 bytes
@blocknote/react@0.51.1     unpackedSize 1,751,550 bytes
@blocknote/mantine@0.51.1   unpackedSize   327,300 bytes
@mantine/core@9.2.1         unpackedSize 8,037,581 bytes
@mantine/hooks@9.2.1        unpackedSize 1,086,876 bytes
@mantine/utils@6.0.22       unpackedSize    86,409 bytes
@radix-ui/react-dialog@1.1.15 unpackedSize 101,511 bytes
```

Package notes:

- `@blocknote/mantine@0.51.1` peer dependencies are `@mantine/core` and `@mantine/hooks`; it does not list `@mantine/utils` as a peer in the installed package metadata.
- `@blocknote/mantine` itself is small; Mantine core is the real incremental install-size cost.
- `@blocknote/react` is not a tiny bare view; it already brings default UI, Floating UI, Tiptap/ProseMirror integration and React components.

## Local installed size

```text
node_modules/@blocknote   12M
node_modules/@mantine     19M
node_modules/@radix-ui   2.0M
node_modules/tailwindcss 832K
node_modules/@tailwindcss 3.0M
node_modules total after Playwright dev install: 377M
```

The `377M` total includes Vite/React/ESLint/TypeScript plus Playwright dev dependency. It should not be read as the BlockNote production cost.

## Vite production output

`npm run build` succeeded.

Relevant output:

```text
dist/assets/index-C64kLmeC.css    40.76 kB, gzip 8.40 kB
dist/assets/module-BubttjgX.js    76.75 kB, gzip 27.54 kB
dist/assets/native-9vIaO2Ji.js   429.05 kB, gzip 82.21 kB
dist/assets/index-D73VYG_u.js  1,255.22 kB, gzip 376.41 kB
dist total                       2.1M
```

Vite warning:

```text
Some chunks are larger than 500 kB after minification.
```

CSS optimizer warning:

```text
@import rules must precede all rules aside from @charset and @layer statements
```

This warning originates from BlockNote/Mantine CSS import composition in the bundled third-party CSS. It did not block build, but Reo implementation should verify whether importing only the required package CSS or ordering imports differently avoids the warning.

## Decision impact

- Mantine adapter is acceptable if Note editor is lazy-loaded behind the note flow.
- Do not put BlockNote editor in the initial renderer path.
- Bundle concern does not trigger Milkdown fallback because the editor works, but it does require code splitting in sub-spec (b).
