import { FormEvent, useState } from "react";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth, AuthUser } from "@/lib/auth";

export default function LoginPage() {
  const { setUser } = useAuth();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          otpCode: otpCode || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "OTP_REQUIRED") setOtpRequired(true);
        throw new Error(data.message ?? "登录失败");
      }
      setUser(data.user as AuthUser);
      toast.success("登录成功");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full grid place-items-center px-4 py-10">
      <form onSubmit={submit} className="card w-full max-w-sm p-6 space-y-5">
        <div className="space-y-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand-glow">
            <LockKeyhole className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-white">OpsPilot 登录</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              后台账号受密码和动态验证码保护。
            </p>
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">用户名</span>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">密码</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
          />
        </label>

        {otpRequired && (
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">动态验证码</span>
            <input
              className="input font-mono tracking-widest"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
              placeholder="000000"
            />
          </label>
        )}

        <button className="btn-primary w-full justify-center" disabled={loading || !username || !password}>
          <ShieldCheck className="w-4 h-4" />
          {loading ? "验证中..." : "登录"}
        </button>
      </form>
    </div>
  );
}
