// src/controllers/VelocidadInternetControlador.ts
import type { Request, Response } from "express";
import snmp, { Session as SnmpSession, Varbind } from "net-snmp";
import os from "node:os";
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { Client as SSHClient, ClientChannel } from "ssh2";

const exec = promisify(execCb);

// ----------------- Tipos -----------------
type StrOrArr = string | string[] | undefined;

type DownloadQuery = { size?: string };

interface IfacesQuery {
  host: string;
  community: string;
  timeout: number;
}

interface WanQuery {
  host: string;
  community: string;
  ifIndex: number;
  interval: number;
  timeout: number;
}

interface ArpQuery {
  host: string;
  community: string;
  timeout: number;
}

interface SshBaseBody {
  routerHost: string;
  sshPort?: number;
  username: string;
  password?: string;
  privateKey?: string; // PEM en texto
}

interface OpenWrtWhitelistBody extends SshBaseBody {
  macs?: string[];
  ifaceIndex?: number; // índice UCI del wifi-iface (0 por defecto)
}

interface MikroTikWhitelistBody extends SshBaseBody {
  macs?: string[];
  wlanName?: string; // ej. "wlan1"
}

interface ChangePasswordBody extends SshBaseBody {
  userToChange?: string; // por defecto 'root'
  newPassword: string;
}

export class VelocidadInternetControlador {
  // ---------- Utilidades generales ----------
  private first(q: StrOrArr): string | undefined {
    if (Array.isArray(q)) return q[0];
    return q;
  }
  private asString(q: StrOrArr, def = ""): string {
    const v = this.first(q);
    return v !== undefined ? String(v) : def;
  }
  private asNumber(q: StrOrArr, def: number): number {
    const v = this.first(q);
    const n = v !== undefined ? Number(v) : def;
    return Number.isFinite(n) ? n : def;
  }
  private bufferToBigInt(buf: Buffer): bigint {
    let result = 0n;
    for (const byte of buf.values()) result = (result << 8n) + BigInt(byte);
    return result;
  }
  private varbindToBigInt(vb: Varbind): bigint {
    const val = vb.value as unknown;
    if (Buffer.isBuffer(val)) return this.bufferToBigInt(val);
    if (typeof val === "number") return BigInt(val >>> 0);
    if (typeof val === "bigint") return val;
    const s = String(val);
    if (/^\d+$/.test(s)) return BigInt(s);
    return 0n;
  }
  private delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ---------- Helpers de red ----------
  private maskToPrefix(mask?: string): number {
    if (!mask) return 0;
    const bits = mask
      .split(".")
      .map((o) => Number(o).toString(2).padStart(8, "0"))
      .join("");
    // Debe ser 1*0*
    if (!/^1*0*$/.test(bits)) return 0;
    return bits.indexOf("0") === -1 ? 32 : bits.indexOf("0");
  }

  private prefixToMask(prefix: number): string {
    if (prefix < 0 || prefix > 32 || Number.isNaN(prefix)) return "";
    const mask = (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0) >>> 0;
    const a = (mask >>> 24) & 255;
    const b = (mask >>> 16) & 255;
    const c = (mask >>> 8) & 255;
    const d = mask & 255;
    return `${a}.${b}.${c}.${d}`;
  }

  private pickIfaceInfo(ifaceName?: string) {
    const all = os.networkInterfaces();
    if (!ifaceName) return null;
    const list = all[ifaceName] || [];
    const v4 = list.find((e) => e.family === "IPv4" && !e.internal);
    if (!v4) return null;
    const cidr = v4.cidr || `${v4.address}/${this.maskToPrefix(v4.netmask)}`;
    return { localIP: v4.address, netmask: v4.netmask, cidr, iface: ifaceName };
  }

  // ---------- SSH helper ----------
  private runSshCommand({
    host,
    port = 22,
    username,
    password,
    privateKey,
    command,
    timeout = 20000,
  }: {
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    command: string;
    timeout?: number;
  }): Promise<{
    code: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
  }> {
    return new Promise((resolve, reject) => {
      const conn = new SSHClient();
      const out = { stdout: "", stderr: "" };

      let timer: NodeJS.Timeout | null = null;
      let finished = false;

      const finish = (
        result: { code: number | null; signal: string | null } | Error
      ) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        try {
          conn.end();
        } catch {}
        if (result instanceof Error) return reject(result);
        resolve({ ...result, stdout: out.stdout, stderr: out.stderr });
      };

      conn
        .on("ready", () => {
          conn.exec(command, (err, stream: ClientChannel) => {
            if (err) return finish(err);

            // Timeout manual del comando
            timer = setTimeout(() => {
              try {
                stream.close();
              } catch {}
              finish(new Error(`SSH exec timeout after ${timeout} ms`));
            }, timeout);

            stream
              .on("close", (code: number | null, signal: string | null) => {
                finish({ code: code ?? null, signal: signal ?? null });
              })
              .on("data", (data: Buffer) => {
                out.stdout += data.toString();
              });
            stream.stderr.on("data", (data: Buffer) => {
              out.stderr += data.toString();
            });
          });
        })
        .on("error", (err) => finish(err))
        .connect({
          host,
          port,
          username,
          password,
          privateKey: privateKey ? Buffer.from(privateKey, "utf8") : undefined,
          readyTimeout: timeout,
        });
    });
  }

  // ----------------- Endpoints -----------------

  // Salud
  public salud = (_req: Request, res: Response) => {
    res.json({ ok: true, ts: Date.now() });
  };

  // Listar interfaces SNMP
  public ifaces = (req: Request<{}, any, any, IfacesQuery>, res: Response) => {
    const {
      host,
      community = "public",
      timeout = 5000,
    } = req.query as unknown as IfacesQuery;

    if (!host) {
      return res.status(400).json({ error: "host requerido" });
    }

    const session: SnmpSession = snmp.createSession(host, community, {
      version: snmp.Version2c,
      timeout: Number(timeout),
    });

    const base = "1.3.6.1.2.1.2.2.1.2"; // ifDescr
    const out: Array<{ idx: number; descr: string }> = [];

    session.subtree(
      base,
      (varbinds: Varbind[]): boolean => {
        for (const vb of varbinds) {
          if (!snmp.isVarbindError(vb)) {
            const parts = vb.oid.split(".");
            const idx = parseInt(parts[parts.length - 1] || "0", 10);
            out.push({ idx, descr: String(vb.value) });
          }
        }
        return true;
      },
      (err?: any) => {
        session.close();
        if (err) return res.status(500).json({ error: String(err) });
        res.json(out.sort((a, b) => a.idx - b.idx));
      }
    );
  };

  // Medición WAN vía SNMP
  public wan = async (req: Request<{}, any, any, WanQuery>, res: Response) => {
    const q = req.query as unknown as Partial<WanQuery>;
    const host = q.host;
    const community = q.community ?? "public";
    const idx = Number(q.ifIndex);
    const intv = Math.max(1, Number(q.interval ?? 5));
    const tout = Number(q.timeout ?? 5000);

    if (!host || !Number.isFinite(idx)) {
      return res
        .status(400)
        .json({ error: "host e ifIndex requeridos (interval >= 1s)" });
    }

    const session: SnmpSession = snmp.createSession(host, community, {
      version: snmp.Version2c,
      timeout: tout,
    });

    type Cnt = { in: bigint; out: bigint; type: "32" };

    const getCounters = (i: number): Promise<Cnt> =>
      new Promise((resolve, reject) => {
        const oids32 = [
          `1.3.6.1.2.1.2.2.1.10.${i}`, // ifInOctets
          `1.3.6.1.2.1.2.2.1.16.${i}`, // ifOutOctets
        ];
        session.get(oids32, (e2, vb2) => {
          if (e2 || !vb2 || vb2.some(snmp.isVarbindError)) {
            return reject(e2 || new Error("SNMP counters not available"));
          }
          return resolve({
            in: BigInt((vb2[0].value as number) >>> 0),
            out: BigInt((vb2[1].value as number) >>> 0),
            type: "32",
          });
        });
      });

    try {
      const c1 = await getCounters(idx);
      await this.delay(intv * 1000);
      const c2 = await getCounters(idx);
      session.close();

      const dIn = c2.in - c1.in;
      const dOut = c2.out - c1.out;
      const in_bps = Number((dIn * 8n) / BigInt(intv));
      const out_bps = Number((dOut * 8n) / BigInt(intv));

      res.json({
        ifIndex: idx,
        counterType: c2.type,
        interval_s: intv,
        in_bps,
        out_bps,
        in_kbps: in_bps / 1e3,
        out_kbps: out_bps / 1e3,
        in_Mbps: in_bps / 1e6,
        out_Mbps: out_bps / 1e6,
      });
    } catch (e) {
      session.close();
      res.status(500).json({ error: String(e) });
    }
  };

  // Tabla ARP vía SNMP
  public arp = (req: Request<{}, any, any, ArpQuery>, res: Response) => {
    const q = req.query as unknown as Partial<ArpQuery>;
    const host = q.host;
    const community = q.community ?? "public";
    const timeout = Number(q.timeout ?? 5000);

    if (!host) return res.status(400).json({ error: "host requerido" });

    const session: SnmpSession = snmp.createSession(host, community, {
      version: snmp.Version2c,
      timeout,
    });

    const BASE = "1.3.6.1.2.1.4.22.1";
    const COL_IFINDEX = "1.3.6.1.2.1.4.22.1.1";
    const COL_PHYS = "1.3.6.1.2.1.4.22.1.2";
    const COL_NETADDR = "1.3.6.1.2.1.4.22.1.3";
    const COL_TYPE = "1.3.6.1.2.1.4.22.1.4";

    type Row = { ifIndex?: number; ip?: string; mac?: string; type?: number };
    const rows: Record<string, Row> = {};

    const keyFromOid = (oid: string, colOid: string) => {
      const parts = oid.split(".");
      const rest = parts.slice(colOid.split(".").length);
      const ifIndex = parseInt(rest[0] || "0", 10);
      const ip = rest.slice(1).join(".");
      return { ifIndex, ip, key: `${ifIndex}_${ip}` };
    };

    session.subtree(
      BASE,
      (varbinds: Varbind[]): boolean => {
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) continue;
          const { oid, value } = vb;

          if (oid.startsWith(COL_IFINDEX)) {
            const { ifIndex, key } = keyFromOid(oid, COL_IFINDEX);
            (rows[key] ||= {}).ifIndex = Number(value);
          } else if (oid.startsWith(COL_PHYS)) {
            const { key } = keyFromOid(oid, COL_PHYS);
            const mac = Buffer.isBuffer(value)
              ? [...(value as Buffer)]
                  .map((b) => b.toString(16).padStart(2, "0"))
                  .join(":")
              : String(value);
            (rows[key] ||= {}).mac = mac;
          } else if (oid.startsWith(COL_NETADDR)) {
            const { key } = keyFromOid(oid, COL_NETADDR);
            (rows[key] ||= {}).ip = String(value);
          } else if (oid.startsWith(COL_TYPE)) {
            const { key } = keyFromOid(oid, COL_TYPE);
            (rows[key] ||= {}).type = Number(value);
          }
        }
        return true;
      },
      (err?: any) => {
        session.close();
        if (err) return res.status(500).json({ error: String(err) });

        const devices = Object.values(rows)
          .filter((r) => r.ip && r.mac && r.ip !== "0.0.0.0")
          .map((r) => ({
            ip: r.ip as string,
            mac: r.mac as string,
            ifIndex: r.ifIndex as number,
            type: r.type as number,
            typeText:
              r.type === 3 ? "dynamic" : r.type === 4 ? "static" : "other",
          }))
          .sort((a, b) => a.ip!.localeCompare(b.ip!));

        res.json({ count: devices.length, devices });
      }
    );
  };

  // OpenWrt: aplicar whitelist
  public OpenWrtWhitelist = async (
    req: Request<unknown, unknown, OpenWrtWhitelistBody>,
    res: Response
  ) => {
    const {
      routerHost,
      sshPort = 22,
      username,
      password,
      privateKey,
      macs = [],
      ifaceIndex = 0,
    } = req.body || {};

    if (!routerHost || !username || (!password && !privateKey)) {
      return res.status(400).json({
        error: "routerHost, username y password o privateKey son requeridos",
      });
    }

    const lines = [
      `uci set wireless.@wifi-iface[${ifaceIndex}].macfilter='allow'`,
      `uci -q delete wireless.@wifi-iface[${ifaceIndex}].maclist`,
      ...macs.map(
        (m) => `uci add_list wireless.@wifi-iface[${ifaceIndex}].maclist='${m}'`
      ),
      `uci commit wireless`,
      `wifi reload`,
    ];
    const script = lines.join("\n");
    const cmd =
      `sh -c 'cat > /tmp/mosan_whitelist.sh <<\"'EOF'\"\n${script}\nEOF\n` +
      `sh /tmp/mosan_whitelist.sh && rm -f /tmp/mosan_whitelist.sh'`;

    try {
      const r = await this.runSshCommand({
        host: routerHost,
        port: sshPort,
        username,
        password,
        privateKey,
        command: cmd,
      });
      res.json({ ok: true, out: r });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  };

  // MikroTik: aplicar whitelist
  public mikroTikWhitelist = async (
    req: Request<unknown, unknown, MikroTikWhitelistBody>,
    res: Response
  ) => {
    const {
      routerHost,
      sshPort = 22,
      username,
      password,
      privateKey,
      macs = [],
      wlanName = "wlan1",
    } = req.body || {};

    if (!routerHost || !username || (!password && !privateKey)) {
      return res.status(400).json({
        error: "routerHost, username y password o privateKey son requeridos",
      });
    }

    const lines = [
      `/interface wireless set ${wlanName} access-list-default-authentication=no`,
      `/interface wireless access-list remove [find]`,
      ...macs.map(
        (m) =>
          `/interface wireless access-list add mac-address=${m} authentication=yes forwarding=yes`
      ),
    ];
    const script = lines.join("\n");
    const cmd =
      `sh -c 'cat > /tmp/mosan_whitelist.rsc <<\"'EOF'\"\n${script}\nEOF\n` +
      `import file=/tmp/mosan_whitelist.rsc; rm -f /tmp/mosan_whitelist.rsc'`;

    try {
      const r = await this.runSshCommand({
        host: routerHost,
        port: sshPort,
        username,
        password,
        privateKey,
        command: cmd,
      });
      res.json({ ok: true, out: r });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  };

  // Cambiar contraseña (Linux/OpenWrt)
  public changepassword = async (
    req: Request<unknown, unknown, ChangePasswordBody>,
    res: Response
  ) => {
    const {
      routerHost,
      sshPort = 22,
      username,
      password,
      privateKey,
      userToChange = "root",
      newPassword,
    } = req.body || {};

    if (
      !routerHost ||
      !username ||
      (!password && !privateKey) ||
      !newPassword
    ) {
      return res.status(400).json({
        error:
          "routerHost, username, password/privateKey y newPassword son requeridos",
      });
    }

    // Si chpasswd no existe, lo reporta en stderr
    const cmd = `echo '${userToChange}:${newPassword}' | chpasswd || (echo 'chpasswd no disponible' >&2)`;

    try {
      const r = await this.runSshCommand({
        host: routerHost,
        port: sshPort,
        username,
        password,
        privateKey,
        command: cmd,
      });
      res.json({ ok: true, out: r });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  };

  // Ping simple
  public ping = (_req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    res.send(`pong ${Date.now()}`);
  };

  // Descarga (para test de bajada)
  public download = (
    req: Request<unknown, unknown, unknown, DownloadQuery>,
    res: Response
  ): void => {
    const MAX = 200 * 1024 * 1024; // 200 MiB
    const DEFAULT_SIZE = 5 * 1024 * 1024; // 5 MiB

    const parsed = Number.parseInt((req.query.size as string) ?? "", 10);
    const size = Math.min(Number.isFinite(parsed) ? parsed : DEFAULT_SIZE, MAX);

    const CHUNK = 64 * 1024;

    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": 'attachment; filename="test.bin"',
      "Cache-Control": "no-store",
      "Content-Encoding": "identity",
      "Content-Length": String(size),
    });

    let sent = 0;
    const pump = () => {
      if (sent >= size) return void res.end();
      const n = Math.min(CHUNK, size - sent);
      const buf = Buffer.allocUnsafe(n).fill(0x61);
      sent += n;
      if (!res.write(buf)) res.once("drain", pump);
      else setImmediate(pump);
    };
    pump();
  };

  // Upload (para test de subida)
  public upload = (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    let bytes = 0;
    req.on("data", (c) => {
      bytes += c.length;
      if (bytes > 200 * 1024 * 1024) {
        res.status(413).end("too big");
        req.destroy();
      }
    });
    req.on("end", () => res.send(`ok ${bytes}`));
    req.on("error", () => res.status(500).send("error"));
  };

  // Detectar gateway + IP local + netmask + CIDR (Linux/macOS/Windows) + default-gateway
  public routerIP = async (_req: Request, res: Response) => {
    // 1) default-gateway (cross-platform)
    try {
      // Manejo de typings y export default/named
      const mod: any = await import("default-gateway");
      const gwMod: any = mod?.default?.v4 ? mod.default : mod;

      if (typeof gwMod?.v4 === "function") {
        const g = await gwMod.v4(); // { gateway, interface }
        if (g?.gateway) {
          const extra = this.pickIfaceInfo(g.interface);
          return res.json({
            routerIP: g.gateway as string,
            via: "default-gateway v4",
            iface: g.interface as string | undefined,
            localIP: extra?.localIP,
            netmask: extra?.netmask,
            cidr: extra?.cidr,
          });
        }
      }
      if (typeof gwMod?.v6 === "function") {
        const g6 = await gwMod.v6();
        if (g6?.gateway) {
          const extra = this.pickIfaceInfo(g6.interface);
          return res.json({
            routerIP: g6.gateway as string,
            via: "default-gateway v6",
            iface: g6.interface as string | undefined,
            localIP: extra?.localIP,
            netmask: extra?.netmask,
            cidr: extra?.cidr,
          });
        }
      }
    } catch {
      // fallbacks
    }

    // 2) Linux: ip route get 1.1.1.1
    try {
      const { stdout } = await exec("ip route get 1.1.1.1");
      const gw = stdout.match(/\svia\s([0-9.]+)/)?.[1];
      const dev = stdout.match(/\sdev\s(\S+)/)?.[1];
      const src = stdout.match(/\ssrc\s([0-9.]+)/)?.[1];

      let netmask: string | undefined;
      let cidr: string | undefined;

      if (dev) {
        const { stdout: a } = await exec(`ip -o -f inet addr show dev ${dev}`);
        const m = a.match(/inet\s([0-9.]+)\/(\d+)/);
        if (m) {
          const ip = m[1];
          const prefix = Number(m[2]);
          const mask = this.prefixToMask(prefix);
          if (mask) {
            netmask = mask;
            cidr = `${ip}/${prefix}`;
          }
        }
      }
      if (gw) {
        return res.json({
          routerIP: gw,
          via: "ip route get",
          iface: dev,
          localIP: src,
          netmask,
          cidr,
        });
      }
    } catch {
      // siguiente fallback
    }

    // 3) macOS
    try {
      const { stdout } = await exec("route -n get default");
      const gw = stdout.match(/gateway:\s*([0-9.]+)/)?.[1];
      const iface = stdout.match(/interface:\s*(\S+)/)?.[1];
      let localIP: string | undefined;
      let cidr: string | undefined;
      let netmask: string | undefined;

      if (iface) {
        const { stdout: a } = await exec(`ipconfig getifaddr ${iface} || true`);
        localIP = a.trim() || undefined;
        const { stdout: p } = await exec(
          `ipconfig getoption ${iface} subnet_mask || true`
        );
        netmask = p.trim() || undefined;
        const prefix = netmask ? this.maskToPrefix(netmask) : undefined;
        if (localIP && prefix !== undefined) cidr = `${localIP}/${prefix}`;
      }
      if (gw) {
        return res.json({
          routerIP: gw,
          via: "route get",
          iface,
          localIP,
          netmask,
          cidr,
        });
      }
    } catch {
      // siguiente
    }

    // 4) Windows
    try {
      const { stdout } = await exec(
        'powershell -NoProfile -Command "(Get-NetRoute -DestinationPrefix 0.0.0.0/0 | Sort-Object RouteMetric | Select-Object -First 1 | Format-List -Property NextHop,InterfaceIndex | Out-String)"'
      );
      const gw = stdout.match(/NextHop\s*:\s*([0-9.]+)/)?.[1];
      const ifIndex = stdout.match(/InterfaceIndex\s*:\s*(\d+)/)?.[1];

      let localIP: string | undefined;
      let cidr: string | undefined;
      let netmask: string | undefined;

      if (ifIndex) {
        const { stdout: ipcfg } = await exec(
          `powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex ${ifIndex} | Select-Object -First 1 | Format-List -Property IPAddress,PrefixLength | Out-String)"`
        );
        localIP = ipcfg.match(/IPAddress\s*:\s*([0-9.]+)/)?.[1];
        const prefix = Number(
          ipcfg.match(/PrefixLength\s*:\s*(\d+)/)?.[1] ?? 0
        );
        if (prefix) {
          const mask = this.prefixToMask(prefix);
          netmask = mask || undefined;
          if (localIP) cidr = `${localIP}/${prefix}`;
        }
      }
      if (gw) {
        return res.json({
          routerIP: gw,
          via: "Get-NetRoute",
          iface: ifIndex,
          localIP,
          netmask,
          cidr,
        });
      }
    } catch {
      // nada
    }

    res.status(500).json({
      error: "No se pudo determinar la IP/máscara del equipo y el gateway",
    });
  };

  // ARP via SSH (routers con BusyBox/OpenWrt)
  public arpDevicesSsh = async (req: Request, res: Response) => {
    const {
      routerHost,
      sshPort = 22,
      username,
      password,
      privateKey,
    } = (req.body || {}) as SshBaseBody;

    if (!routerHost || !username || (!password && !privateKey)) {
      return res.status(400).json({
        error: "routerHost, username y password/privateKey requeridos",
      });
    }

    try {
      const cmd = `
        (test -f /tmp/dhcp.leases && awk '{print $3","$2","$4}' /tmp/dhcp.leases) 2>/dev/null | sed 's/$/,lease/g';
        ip neigh 2>/dev/null | awk '{print $1","$5",," $3}' | sed 's/REACHABLE/arp/;s/STALE/arp/;s/DELAY/arp/;s/PROBE/arp/;s/FAILED/arp/';
      `.trim();

      const out = await this.runSshCommand({
        host: routerHost,
        port: sshPort,
        username,
        password,
        privateKey,
        command: cmd,
      });

      const lines = (out.stdout || "")
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      const map = new Map<
        string,
        { ip: string; mac: string; host: string; source: string }
      >();

      for (const ln of lines) {
        // "IP,MAC,HOST,lease" o "IP,MAC,,arp"
        const [ip, macRaw, hostMaybe, source] = ln.split(",");
        const mac = (macRaw || "").toLowerCase();
        if (
          !/^\d+\.\d+\.\d+\.\d+$/.test(ip || "") ||
          !/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(mac)
        )
          continue;

        const prev = map.get(mac) || { ip, mac, host: "", source: "" };
        map.set(mac, {
          ip: prev.ip || ip,
          mac,
          host: prev.host || hostMaybe || "",
          source: prev.source ? prev.source : source || "",
        });
      }

      const devices = Array.from(map.values()).sort((a, b) =>
        a.ip.localeCompare(b.ip)
      );
      return res.json({ count: devices.length, devices });
    } catch (e) {
      return res.status(500).json({ error: String(e) });
    }
  };
}
