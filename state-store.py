#!/usr/bin/python3
# Hardened state store for Omarchy RSS-Feeder.
#
# The plugin runs unsandboxed inside the long-running Omarchy shell, so its
# automatic state migration and its recurring state writes must not be
# redirectable by a symlink planted anywhere under ~/.local/share. Every
# directory in the chain (HOME -> .local -> share -> omarchy-rss-feeder) and
# every file is opened descriptor-relative with O_NOFOLLOW and verified to be
# owned by the current user and not group/other writable. Reads are bounded.
# Writes go to a randomized O_EXCL temp file in the same verified directory
# that is fsynced and atomically renamed over state.json (atomic durable
# replace); the directory is fsynced so the rename survives a crash.
#
# Subcommands:
#   read   Ensure the store directory, migrate a legacy state.json once if ours
#          is absent, then copy state.json to stdout. Exit 3 if no state exists.
#   write  Read new state.json content from stdin (bounded) and atomically
#          replace state.json.
#
# It performs no network access and never follows a symlink into a location it
# did not itself create and verify.

import binascii
import errno
import os
import stat
import sys

APP_DIR = "omarchy-rss-feeder"
# Older forks this plugin descends from; their state is imported once.
LEGACY_DIRS = ("omarchy-rss-reeder", "omarchy-rss-plugin")
STATE_NAME = "state.json"
MAX_BYTES = 64 * 1024 * 1024  # ceiling for every read and write

EXIT_OK = 0
EXIT_USAGE = 1
EXIT_ENV = 2
EXIT_NO_STATE = 3
EXIT_UNSAFE = 4
EXIT_IO = 5

DIR_FLAGS = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW | os.O_CLOEXEC


def die(code, msg):
    sys.stderr.write("state-store: %s\n" % msg)
    sys.exit(code)


def verify_owned_dir(fd, label):
    st = os.fstat(fd)
    if not stat.S_ISDIR(st.st_mode):
        die(EXIT_UNSAFE, "%s is not a directory" % label)
    if st.st_uid != os.geteuid():
        die(EXIT_UNSAFE, "%s is not owned by the current user" % label)
    if st.st_mode & (stat.S_IWGRP | stat.S_IWOTH):
        die(EXIT_UNSAFE, "%s is group- or world-writable" % label)


def open_home():
    home = os.environ.get("HOME") or ""
    if not home or not os.path.isabs(home):
        die(EXIT_ENV, "HOME is unset or not an absolute path")
    try:
        fd = os.open(home, DIR_FLAGS)
    except OSError as e:
        if e.errno == errno.ELOOP:
            die(EXIT_UNSAFE, "HOME is a symlink")
        die(EXIT_ENV, "cannot open HOME: %s" % e)
    verify_owned_dir(fd, "HOME")
    return fd


def open_child_dir(parent_fd, name, label, create):
    try:
        fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
    except OSError as e:
        if e.errno == errno.ENOENT and create:
            try:
                os.mkdir(name, 0o700, dir_fd=parent_fd)
            except FileExistsError:
                pass
            except OSError as e2:
                die(EXIT_IO, "cannot create %s: %s" % (label, e2))
            fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        elif e.errno == errno.ENOENT:
            return None
        elif e.errno in (errno.ELOOP, errno.ENOTDIR):
            die(EXIT_UNSAFE, "%s is a symlink or not a directory" % label)
        else:
            die(EXIT_IO, "cannot open %s: %s" % (label, e))
    verify_owned_dir(fd, label)
    return fd


def open_store(create):
    """Return (share_fd, app_fd) for a verified no-symlink chain, or exit."""
    home_fd = open_home()
    try:
        local_fd = open_child_dir(home_fd, ".local", "~/.local", create)
    finally:
        os.close(home_fd)
    if local_fd is None:
        return None, None
    try:
        share_fd = open_child_dir(local_fd, "share", "~/.local/share", create)
    finally:
        os.close(local_fd)
    if share_fd is None:
        return None, None
    app_fd = open_child_dir(share_fd, APP_DIR, "~/.local/share/" + APP_DIR, create)
    if app_fd is None:
        os.close(share_fd)
        return None, None
    return share_fd, app_fd


def read_regular_file(dir_fd, name, label):
    """Bounded read of a regular, user-owned, non-symlink file, or None."""
    try:
        fd = os.open(name, os.O_RDONLY | os.O_NOFOLLOW | os.O_CLOEXEC, dir_fd=dir_fd)
    except OSError as e:
        if e.errno == errno.ENOENT:
            return None
        if e.errno == errno.ELOOP:
            die(EXIT_UNSAFE, "%s is a symlink" % label)
        die(EXIT_IO, "cannot open %s: %s" % (label, e))
    try:
        st = os.fstat(fd)
        if not stat.S_ISREG(st.st_mode):
            die(EXIT_UNSAFE, "%s is not a regular file" % label)
        if st.st_uid != os.geteuid():
            die(EXIT_UNSAFE, "%s is not owned by the current user" % label)
        if st.st_size > MAX_BYTES:
            die(EXIT_UNSAFE, "%s exceeds the %d byte limit" % (label, MAX_BYTES))
        data = bytearray()
        while len(data) <= MAX_BYTES:
            chunk = os.read(fd, 1 << 16)
            if not chunk:
                break
            data += chunk
        if len(data) > MAX_BYTES:
            die(EXIT_UNSAFE, "%s exceeds the %d byte limit" % (label, MAX_BYTES))
        return bytes(data)
    finally:
        os.close(fd)


def atomic_write(dir_fd, name, data):
    """Randomized O_EXCL temp in dir_fd, fsync, atomic rename, fsync dir."""
    suffix = binascii.hexlify(os.urandom(8)).decode("ascii")
    tmp = ".%s.%s.tmp" % (name, suffix)
    fd = os.open(
        tmp,
        os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW | os.O_CLOEXEC,
        0o600,
        dir_fd=dir_fd,
    )
    try:
        view = memoryview(data)
        while view:
            written = os.write(fd, view[: 1 << 16])
            view = view[written:]
        os.fsync(fd)
    except BaseException:
        os.close(fd)
        _silent_unlink(dir_fd, tmp)
        raise
    os.close(fd)
    try:
        os.replace(tmp, name, src_dir_fd=dir_fd, dst_dir_fd=dir_fd)
    except OSError:
        _silent_unlink(dir_fd, tmp)
        raise
    try:
        os.fsync(dir_fd)
    except OSError:
        pass


def _silent_unlink(dir_fd, name):
    try:
        os.unlink(name, dir_fd=dir_fd)
    except OSError:
        pass


def migrate_legacy(share_fd, app_fd):
    """If we have no state.json, import one from a legacy fork dir, once."""
    for legacy in LEGACY_DIRS:
        legacy_fd = open_child_dir(share_fd, legacy, "~/.local/share/" + legacy, False)
        if legacy_fd is None:
            continue
        try:
            data = read_regular_file(legacy_fd, STATE_NAME, "~/.local/share/%s/%s" % (legacy, STATE_NAME))
        finally:
            os.close(legacy_fd)
        if data is not None:
            atomic_write(app_fd, STATE_NAME, data)
            return data
    return None


def cmd_read():
    share_fd, app_fd = open_store(create=True)
    if app_fd is None:
        sys.exit(EXIT_NO_STATE)
    try:
        data = read_regular_file(app_fd, STATE_NAME, "state.json")
        if data is None:
            data = migrate_legacy(share_fd, app_fd)
        if data is None:
            sys.exit(EXIT_NO_STATE)
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        return EXIT_OK
    finally:
        os.close(app_fd)
        os.close(share_fd)


def cmd_write():
    data = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        die(EXIT_UNSAFE, "input exceeds the %d byte limit" % MAX_BYTES)
    share_fd, app_fd = open_store(create=True)
    if app_fd is None:
        die(EXIT_IO, "cannot open the state directory")
    try:
        atomic_write(app_fd, STATE_NAME, data)
        return EXIT_OK
    finally:
        os.close(app_fd)
        os.close(share_fd)


def main(argv):
    if len(argv) != 2 or argv[1] not in ("read", "write"):
        die(EXIT_USAGE, "usage: state-store.py {read|write}")
    if argv[1] == "read":
        return cmd_read()
    return cmd_write()


if __name__ == "__main__":
    try:
        sys.exit(main(sys.argv))
    except OSError as error:
        die(EXIT_IO, str(error))
