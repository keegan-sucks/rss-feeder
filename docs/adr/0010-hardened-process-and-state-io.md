---
status: accepted
---

# Absolute tool paths and no-follow state I/O

The plugin runs unsandboxed inside the long-running Omarchy shell, with the
shell user's full privileges. The marketplace runtime review flagged two ways
that trust could be subverted without any further user action, and this ADR
records how both are closed.

## Ambient executable lookup → trusted absolute paths

Every child process — `curl` (feed and Shorts fetches), `python3` (OPML chooser
and file read/write), and `omarchy-file-select` (OPML import picker) — was
launched by bare command name, resolved through the inherited `PATH`. A binary
planted earlier in `PATH` would then run as the user on the plugin's automatic
schedule. All launches now use absolute, distribution-standard paths
(`/usr/bin/python3`, `/usr/bin/curl`, `/usr/bin/omarchy-file-select`), and the
state helper is resolved from this component's own directory via
`Qt.resolvedUrl`, never from `PATH`.

## Pathname-following state migration and writes → `state-store.py`

State migration used `sh -c` with `mkdir -p`/`cp` that follow whatever the
pathnames resolve to, and recurring writes went through `FileView` by pathname.
A symlink planted at `~/.local/share`, the plugin's own directory, or
`state.json` could therefore redirect the automatic migration or every state
write to an attacker-chosen location.

Both now go through `state-store.py`, which:

- descends `HOME → .local → share → omarchy-rss-feeder` opening each component
  descriptor-relative with `O_NOFOLLOW`, and verifies each is a real directory
  owned by the current user and not group/world-writable — a symlink anywhere
  in the chain is refused rather than followed;
- reads `state.json` (and any legacy fork's state, migrated once) only as a
  regular, user-owned, non-symlink file, with a bounded read;
- writes to a randomized `O_EXCL` temp file in the same verified directory,
  `fsync`s it, atomically `rename`s it over `state.json`, and `fsync`s the
  directory — an atomic, durable replace.

The payload is passed to the writer over stdin, never on argv. Writes are
serialized and coalesced in `BarWidget.qml`, so overlapping persists cannot
race.

## Cost

Strict `O_NOFOLLOW` on the directory chain means a user who has symlinked
`~/.local` or `~/.local/share` elsewhere gets a visible refusal instead of a
silently redirected write. That is the intended trade: for an unsandboxed
plugin, refusing an unverifiable path is safer than trusting it.
