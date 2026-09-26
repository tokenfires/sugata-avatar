"""macOS receipt for a fresh direct child of this controller. Never decode environment bytes."""
import ctypes as C
import hashlib
import json
import os
import platform
import struct
import subprocess
import sys


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def parse_procargs(raw):
    require(len(raw) >= 5, 'Truncated procargs header')
    argc = struct.unpack_from('=i', raw)[0]
    require(0 < argc <= 65536, 'Invalid native argc')
    end = raw.find(b'\0', 4)
    require(end > 4, 'Missing native executable path')
    executable = raw[4:end].decode('utf-8', errors='strict')
    cursor = end + 1
    while cursor < len(raw) and raw[cursor] == 0:
        cursor += 1
    argv = []
    for _ in range(argc):
        end = raw.find(b'\0', cursor)
        require(end >= cursor, 'Truncated native argument vector')
        argv.append(raw[cursor:end].decode('utf-8', errors='strict'))
        cursor = end + 1
    require(argv[0] != '', 'Empty argv[0]')
    # Everything after exactly argc strings may contain the environment. Do not inspect it.
    return {'argc': argc, 'kernelExecutable': executable, 'argv': argv}


class BSDInfo(C.Structure):
    _fields_ = [(n, C.c_uint32) for n in ['flags', 'status', 'xstatus', 'pid', 'ppid', 'uid', 'gid', 'ruid', 'rgid', 'svuid', 'svgid', 'reserved']] + [
        ('comm', C.c_char * 16), ('name', C.c_char * 32)] + [(n, C.c_uint32) for n in ['nfiles', 'pgid', 'pjobc', 'e_tdev', 'e_tpgid']] + [
        ('nice', C.c_int32), ('start_sec', C.c_uint64), ('start_usec', C.c_uint64)]


def identity(pid):
    lib = C.CDLL('/usr/lib/libproc.dylib', use_errno=True)
    lib.proc_pidinfo.argtypes = [C.c_int, C.c_int, C.c_uint64, C.c_void_p, C.c_int]
    lib.proc_pidinfo.restype = C.c_int
    info = BSDInfo()
    require(C.sizeof(info) == 136, 'Unsupported proc_bsdinfo ABI')
    require(lib.proc_pidinfo(pid, 3, 0, C.byref(info), C.sizeof(info)) == C.sizeof(info), 'Cannot read process birth identity')
    require(info.pid == pid and info.start_sec > 0 and info.start_usec < 1000000, 'Invalid process identity')
    return {'pid': info.pid, 'ppid': info.ppid, 'start': [info.start_sec, info.start_usec]}


def read_process(pid, root):
    first = identity(pid)
    require(first['ppid'] == root, 'Process is not a direct controller child')
    lib = C.CDLL('/usr/lib/libproc.dylib', use_errno=True)
    lib.proc_pidpath.argtypes = [C.c_int, C.c_void_p, C.c_uint32]
    lib.proc_pidpath.restype = C.c_int
    buf = C.create_string_buffer(4096)
    size = lib.proc_pidpath(pid, buf, len(buf))
    require(0 < size < len(buf), 'Cannot read exact process executable path')
    executable = buf.value.decode('utf-8', errors='strict')
    libc = C.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
    libc.sysctl.argtypes = [C.POINTER(C.c_int), C.c_uint, C.c_void_p, C.POINTER(C.c_size_t), C.c_void_p, C.c_size_t]
    libc.sysctl.restype = C.c_int
    mib, count = (C.c_int * 3)(1, 49, pid), C.c_size_t()
    require(libc.sysctl(mib, 3, None, C.byref(count), None, 0) == 0 and 0 < count.value <= 8 * 1024 * 1024, 'Cannot size native argv')
    raw = C.create_string_buffer(count.value)
    require(libc.sysctl(mib, 3, raw, C.byref(count), None, 0) == 0, 'Cannot read native argv')
    args = parse_procargs(raw.raw[:count.value])
    require(identity(pid) == first, 'PID/parent/birth identity changed during read')
    require(os.path.realpath(args['kernelExecutable']) == os.path.realpath(executable), 'Kernel executable/path disagreement')
    require(os.path.realpath(args['argv'][0]) == os.path.realpath(executable), 'argv[0]/executable disagreement')
    return {**first, 'executable': executable, **args}


def child_tree(root):
    # Inventory contains PID/PPID only. No unrelated process command or environment is read.
    rows = [tuple(map(int, line.split())) for line in subprocess.check_output(['/bin/ps', '-axo', 'pid=,ppid='], text=True).splitlines() if line.strip()]
    descendants, excluded = {root}, {os.getpid()}
    for _ in rows:
        grew = False
        for pid, ppid in rows:
            if ppid in excluded and pid not in excluded:
                excluded.add(pid)
            if ppid in descendants and pid not in descendants:
                descendants.add(pid)
                grew = True
        if not grew:
            break
    return [{'pid': pid, 'ppid': ppid} for pid, ppid in sorted(rows) if pid != root and pid in descendants and pid not in excluded]


def select_browser(processes, root, prior_pids, required_flags):
    candidates = [p for p in processes if p['ppid'] == root and p['pid'] not in prior_pids and
                  '--remote-debugging-pipe' in p['argv'] and '--no-startup-window' in p['argv'] and
                  not any(a.startswith('--type=') for a in p['argv'])]
    require(len(candidates) == 1, 'Require exactly one new browser main child')
    selected = candidates[0]
    require(all(flag in selected['argv'] for flag in required_flags), 'Missing actual requested browser flags')
    require(not any(a in selected['argv'] for a in ['--disable-gpu-vsync', '--disable-frame-rate-limit']), 'Unthrottled browser is outside this protocol')
    profiles = [a.split('=', 1)[1] for a in selected['argv'] if a.startswith('--user-data-dir=')]
    require(len(profiles) == 1 and os.path.basename(profiles[0]).startswith('playwright_chromiumdev_profile-'), 'Unexpected native browser profile')
    return selected


def main(request):
    require(platform.system() == 'Darwin', 'This native receipt supports macOS only')
    root = request['rootPID']
    require(type(root) is int and root == os.getppid(), 'Can inspect only the calling controller child tree')
    tree = child_tree(root)
    if request['operation'] == 'snapshot':
        return {'rootPID': root, 'tree': tree}
    require(request['operation'] == 'capture', 'Unsupported process receipt operation')
    before = request['before']
    require(before['rootPID'] == root, 'Before-snapshot belongs to another controller')
    prior = {row['pid'] for row in before['tree']}
    processes = [read_process(row['pid'], root) for row in tree if row['ppid'] == root and row['pid'] not in prior]
    selected = select_browser(processes, root, prior, request['requiredFlags'])
    actual_hash = hashlib.sha256(open(selected['executable'], 'rb').read()).hexdigest()
    require(os.path.realpath(selected['executable']) == os.path.realpath(request['expectedExecutable']), 'Actual executable differs from pinned registry hint')
    require(actual_hash == request['expectedSHA256'], 'Actual executable bytes differ from registry hint')
    require(read_process(selected['pid'], root) == selected, 'Process changed during executable hashing/final read')
    return {'rootPID': root, 'before': before['tree'], 'after': tree, 'selected': selected,
            'executableSHA256': actual_hash, 'registryPathAndHashMatch': True,
            'method': 'New direct child PID/PPID; proc_pidinfo birth identity; proc_pidpath; exactly argc KERN_PROCARGS2 strings; repeated identity/argv read after executable hashing.',
            'environmentDecodedOrEmitted': False, 'python': {'executable': sys.executable, 'version': platform.python_version()}}


if __name__ == '__main__':
    print(json.dumps(main(json.load(sys.stdin)), ensure_ascii=False))
