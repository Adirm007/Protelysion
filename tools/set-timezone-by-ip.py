#!/usr/bin/env python3
"""根据公网 IP 的地理位置，修改本机系统时区。

只访问公开的 IP 定位服务，不会连接你输入的那个 IP。
定位结果是地址登记的位置；机房、VPN 和任播地址可能和实际使用地不一致。
修改的是整台机器的系统时区，需要管理员权限。
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

ZONEINFO_ROOT = Path("/usr/share/zoneinfo")
TIMEZONE_NAME = re.compile(r"[A-Za-z0-9._+-]+(?:/[A-Za-z0-9._+-]+)*")
PROVIDER_RANK = {"ipwho.is": 0, "ipapi.co": 1, "ip-api.com": 2}


class LookupError(Exception):
    """定位服务没有给出可用结果。"""


class ApplyError(Exception):
    """系统时区没有改成功。"""


@dataclass(frozen=True)
class Hit:
    provider: str
    timezone: str
    location: str


def normalize_ip_text(text: str) -> str:
    text = text.strip()
    if len(text) >= 2 and text[0] == "[" and text[-1] == "]":
        text = text[1:-1].strip()
    return text


def parse_public_ip(text: str) -> str:
    raw = normalize_ip_text(text)
    if not raw:
        raise LookupError("请输入 IP 地址")
    try:
        address = ipaddress.ip_address(raw)
    except ValueError:
        raise LookupError(f"无法识别的 IP 地址：{raw}") from None
    mapped = getattr(address, "ipv4_mapped", None)
    if mapped is not None:
        address = mapped
    if not address.is_global:
        raise LookupError(
            f"{address} 不是公网 IP（私有、本机、链路本地或保留地址），无法查询地理位置"
        )
    return str(address)


def _place(*parts: object) -> str:
    names: list[str] = []
    for part in parts:
        if isinstance(part, str):
            text = part.strip()
            if text and text not in names:
                names.append(text)
    return ", ".join(names)


def http_get_json(url: str) -> dict[str, object]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "set-timezone-by-ip/1.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read(1_000_000)
    except urllib.error.HTTPError as exc:
        raise LookupError(f"HTTP {exc.code}") from exc
    except urllib.error.URLError as exc:
        raise LookupError(f"网络错误：{exc.reason}") from exc
    except TimeoutError as exc:
        raise LookupError("请求超时") from exc
    try:
        data = json.loads(raw.decode("utf-8", errors="replace"))
    except json.JSONDecodeError as exc:
        raise LookupError("返回的不是 JSON") from exc
    if not isinstance(data, dict):
        raise LookupError("返回的 JSON 不是对象")
    return data


def _timezone_field(data: dict[str, object], provider: str) -> str:
    timezone = data.get("timezone")
    if isinstance(timezone, str) and timezone.strip():
        return timezone.strip()
    if isinstance(timezone, dict):
        zone_id = timezone.get("id")
        if isinstance(zone_id, str) and zone_id.strip():
            return zone_id.strip()
    raise LookupError(f"{provider} 没有返回时区")


def lookup_ipwho(ip: str) -> Hit:
    data = http_get_json(f"https://ipwho.is/{quote(ip, safe=':')}")
    if data.get("success") is False:
        message = data.get("message")
        raise LookupError(str(message or "查询失败"))
    return Hit(
        "ipwho.is",
        _timezone_field(data, "ipwho.is"),
        _place(data.get("city"), data.get("region"), data.get("country")),
    )


def lookup_ipapi_co(ip: str) -> Hit:
    data = http_get_json(f"https://ipapi.co/{quote(ip, safe=':')}/json/")
    if data.get("error"):
        reason = data.get("reason")
        raise LookupError(str(reason or "查询失败"))
    country = data.get("country_name") or data.get("country")
    return Hit(
        "ipapi.co",
        _timezone_field(data, "ipapi.co"),
        _place(data.get("city"), data.get("region"), country),
    )


def lookup_ip_api(ip: str) -> Hit:
    fields = "status,message,country,regionName,city,timezone,query"
    data = http_get_json(
        f"http://ip-api.com/json/{quote(ip, safe=':')}?fields={fields}"
    )
    if data.get("status") != "success":
        message = data.get("message")
        raise LookupError(str(message or "查询失败"))
    return Hit(
        "ip-api.com",
        _timezone_field(data, "ip-api.com"),
        _place(data.get("city"), data.get("regionName"), data.get("country")),
    )


PROVIDERS = (
    (lookup_ipwho, "ipwho.is"),
    (lookup_ipapi_co, "ipapi.co"),
    (lookup_ip_api, "ip-api.com"),
)


def lookup_all(ip: str) -> tuple[list[Hit], list[str]]:
    hits: list[Hit | None] = [None] * len(PROVIDERS)
    errors: list[str] = []
    with ThreadPoolExecutor(max_workers=len(PROVIDERS)) as pool:
        futures = {
            pool.submit(fn, ip): (index, name) for index, (fn, name) in enumerate(PROVIDERS)
        }
        for future in as_completed(futures):
            index, provider = futures[future]
            try:
                hits[index] = future.result()
            except Exception as exc:
                message = str(exc).strip().splitlines()[0][:200] or exc.__class__.__name__
                errors.append(f"{provider}: {message}")
    return [hit for hit in hits if hit is not None], errors


def zoneinfo_file(timezone: str) -> Path:
    """返回时区文件路径。只接受时区库里的真实文件，拒绝路径穿越。"""
    if not ZONEINFO_ROOT.is_dir():
        raise LookupError("本机没有时区数据库 /usr/share/zoneinfo，无法设置系统时区")
    parts = timezone.split("/")
    if (
        not TIMEZONE_NAME.fullmatch(timezone)
        or any(part in {"", ".", ".."} for part in parts)
    ):
        raise LookupError(f"时区名称不合法：{timezone}")
    root = ZONEINFO_ROOT.resolve()
    path = ZONEINFO_ROOT.joinpath(*parts)
    parent = path.parent.resolve()
    target = path.resolve()
    if not parent.is_relative_to(root) or not target.is_relative_to(root) or not path.is_file():
        raise LookupError(f"本机时区库中没有 {timezone}")
    return path


def choose(hits: list[Hit]) -> tuple[Hit, list[Hit]]:
    usable: list[Hit] = []
    rejected: list[str] = []
    for hit in hits:
        try:
            zoneinfo_file(hit.timezone)
        except LookupError as exc:
            rejected.append(f"{hit.provider}: {exc}")
            continue
        usable.append(hit)
    if not usable:
        detail = "；".join(rejected) or "没有可用的定位结果"
        raise LookupError(f"没有能在本机使用的时区。{detail}")

    counts = Counter(hit.timezone for hit in usable)

    def score(timezone: str) -> tuple[int, int]:
        group = [hit for hit in usable if hit.timezone == timezone]
        rank = min(PROVIDER_RANK.get(hit.provider, 9) for hit in group)
        return (-counts[timezone], rank)

    best = min({hit.timezone for hit in usable}, key=score)
    chosen = min(
        (hit for hit in usable if hit.timezone == best),
        key=lambda hit: PROVIDER_RANK.get(hit.provider, 9),
    )
    return chosen, usable


def _timezone_from_zoneinfo_path(path: str) -> str | None:
    marker = "/zoneinfo/"
    if marker not in path:
        return None
    timezone = path.split(marker, 1)[1]
    if timezone.startswith(("posix/", "right/")):
        timezone = timezone.split("/", 1)[1]
    if not timezone or timezone.endswith("/"):
        return None
    return timezone


def system_timezone() -> str | None:
    link = Path("/etc/localtime")
    try:
        raw = os.readlink(link)
    except OSError:
        raw = ""
    if raw:
        timezone = _timezone_from_zoneinfo_path(raw)
        if timezone:
            return timezone
        timezone = _timezone_from_zoneinfo_path(str((link.parent / raw).resolve()))
        if timezone:
            return timezone
    etc = Path("/etc/timezone")
    if etc.is_file():
        text = etc.read_text(encoding="utf-8", errors="replace").strip()
        if text:
            return text
    return None


def is_root() -> bool:
    geteuid = getattr(os, "geteuid", None)
    return bool(geteuid and geteuid() == 0)


def run_root(args: list[str], input_text: str | None = None) -> subprocess.CompletedProcess[str]:
    if not is_root() and shutil.which("sudo") is None:
        raise ApplyError("需要管理员权限，但系统里没有 sudo")
    command = args if is_root() else ["sudo", "--", *args]
    return subprocess.run(
        command,
        check=True,
        input=input_text,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=20,
    )


def _process_error(exc: Exception) -> str:
    stderr = getattr(exc, "stderr", None)
    stdout = getattr(exc, "stdout", None)
    text = stderr or stdout or ""
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")
    line = str(text).strip().splitlines()
    return line[0][:300] if line else ""


def sync_etc_timezone(timezone: str) -> None:
    if not (Path("/etc/timezone").exists() or Path("/etc/debian_version").exists()):
        return
    run_root(["tee", "/etc/timezone"], input_text=timezone + "\n")


def apply_linux(timezone: str) -> None:
    zonefile = str(zoneinfo_file(timezone))
    if shutil.which("timedatectl"):
        try:
            run_root(["timedatectl", "set-timezone", timezone])
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            pass
        else:
            if system_timezone() == timezone:
                try:
                    sync_etc_timezone(timezone)
                except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
                    pass
                return
    try:
        run_root(["ln", "-sfn", zonefile, "/etc/localtime"])
        sync_etc_timezone(timezone)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        detail = _process_error(exc)
        raise ApplyError(detail or "无法修改 /etc/localtime") from exc
    got = system_timezone()
    if got != timezone:
        raise ApplyError(f"修改后系统时区是 {got or '未知'}，不是 {timezone}")


def apply_darwin(timezone: str) -> None:
    zoneinfo_file(timezone)
    if not shutil.which("systemsetup"):
        raise ApplyError("找不到 systemsetup，无法在 macOS 上修改时区")
    try:
        run_root(["systemsetup", "-settimezone", timezone])
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
        detail = _process_error(exc)
        raise ApplyError(detail or "systemsetup 修改时区失败") from exc
    got = system_timezone()
    if got not in (None, timezone):
        raise ApplyError(f"修改后系统时区是 {got}，不是 {timezone}")


def apply_timezone(timezone: str) -> None:
    system = platform.system()
    if system == "Linux":
        apply_linux(timezone)
        return
    if system == "Darwin":
        apply_darwin(timezone)
        return
    raise ApplyError(f"目前只支持 Linux 和 macOS，当前系统是 {system}")


def print_match(ip: str, chosen: Hit, hits: list[Hit]) -> None:
    print(f"IP：{ip}")
    print(f"位置：{chosen.location or '未知'}")
    print(f"时区：{chosen.timezone}")
    zones = {hit.timezone for hit in hits}
    if len(hits) == 1:
        print(f"来源：{chosen.provider}")
        return
    if len(zones) == 1:
        names = "、".join(hit.provider for hit in hits)
        print(f"来源：{names}（结果一致）")
        return
    counts = Counter(hit.timezone for hit in hits)
    winner_count = counts[chosen.timezone]
    tied = [timezone for timezone, count in counts.items() if count == winner_count]
    if len(tied) > 1:
        print(
            "不同定位服务的结果不一致，且没有多数。"
            f"已采用 {chosen.provider} 的结果："
        )
    else:
        print("不同定位服务的结果不一致，已采用出现次数最多的时区：")
    for hit in hits:
        where = hit.location or "位置未知"
        marker = "*" if hit.timezone == chosen.timezone else "-"
        print(f"  {marker} {hit.provider}：{hit.timezone}（{where}）")


def read_ip(argument: str | None) -> str:
    if argument is not None:
        return argument
    if sys.stdin.isatty():
        try:
            return input("请输入 IP 地址：")
        except EOFError:
            raise LookupError("请输入 IP 地址") from None
    data = sys.stdin.read().strip()
    if not data:
        raise LookupError("请提供公网 IP，例如：set-timezone-by-ip.py 8.8.8.8")
    return data.splitlines()[0].strip()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="set-timezone-by-ip.py",
        description="查询公网 IP 所在时区，并把本机系统时区改成该时区。",
        epilog=(
            "示例：\n"
            "  %(prog)s 8.8.8.8\n"
            "  %(prog)s --dry-run 1.1.1.1\n"
            "  %(prog)s\n"
            "\n"
            "不带参数时会提示输入 IP。--dry-run 只查询，不修改系统。"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("ip", nargs="?", help="公网 IPv4 或 IPv6 地址")
    parser.add_argument(
        "-n",
        "--dry-run",
        action="store_true",
        help="只查询并显示将要设置的时区，不修改系统",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        ip = parse_public_ip(read_ip(args.ip))
        hits, errors = lookup_all(ip)
        if not hits:
            print("查询 IP 时区失败。", file=sys.stderr)
            for line in errors:
                print(f"  {line}", file=sys.stderr)
            return 2
        chosen, usable = choose(hits)
    except LookupError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    print_match(ip, chosen, usable)
    current = system_timezone()
    if current == chosen.timezone:
        print(f"系统时区已经是 {current}，无需修改。")
        return 0
    if current:
        print(f"当前系统时区：{current}")
    if args.dry_run:
        print("预览模式，未修改系统时区。")
        return 0

    try:
        apply_timezone(chosen.timezone)
    except ApplyError as exc:
        print(f"修改系统时区失败：{exc}", file=sys.stderr)
        return 3

    applied = system_timezone() or chosen.timezone
    local_now = datetime.now(ZoneInfo(chosen.timezone)).strftime("%Y-%m-%d %H:%M:%S %Z")
    print(f"已将系统时区改为 {applied}。")
    print(f"该时区当前时间：{local_now}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("\n已取消。", file=sys.stderr)
        raise SystemExit(130) from None
