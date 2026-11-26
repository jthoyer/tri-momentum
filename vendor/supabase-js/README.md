# vendor/supabase-js

The Supabase JavaScript client, vendored so `index.html` can load it with a plain
`<script src="vendor/supabase-js/supabase.js">`. Same origin, no CDN, no build step.

| | |
|---|---|
| Package | `@supabase/supabase-js` |
| Version | **2.118.0** (published 2026-10-15) |
| Licence | MIT (`LICENSE` in this folder, copied from the package) |
| File | `supabase.js` = the package's `dist/umd/supabase.js`, unmodified. It defines the global `supabase` (`supabase.createClient`). |
| Source | `npm pack @supabase/supabase-js@2.118.0` (registry.npmjs.org) |
| Tarball SHA-256 | `f2d4f13a8d7a96bdbf338b6f6887a475d1bbca438c6668172b867a94e3d454cf` (`supabase-supabase-js-2.118.0.tgz`) |
| Tarball integrity (npm `dist.integrity`, matched) | `sha512-FxI8UXMVC2UG7IkeiI8fuQZqq2oI3JeSuN8MPIC2RLVaoEAxKS0nqE6kii9Ewpq8f9gNPM6git1Y8f0vN/QLFw==` |
| `supabase.js` SHA-256 | `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3` |

## Upgrading, or re-checking this file

```sh
mkdir -p /tmp/sbpack && cd /tmp/sbpack && npm pack @supabase/supabase-js@<version> --ignore-scripts
# extract in its own empty directory; do not run anything from it
tar -xzf supabase-supabase-js-<version>.tgz -C <empty dir>
sha256sum <empty dir>/package/dist/umd/supabase.js /path/to/repo/vendor/supabase-js/supabase.js
```

The two hashes must match. Update the table above and the version recorded in `CLAUDE.md`
(Storage & sync) in the same change. Do not edit `supabase.js` by hand.

`tests/supabase-config.test.js` checks that this file exists and that its SHA-256 equals the value
recorded here, so a changed file fails `npm test` until this README is updated on purpose.
