"use client";

import { useState } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const SignInLayer = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step 1: Rate limit + team_users check via API route
      const checkRes = await fetch("/api/auth/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok) {
        setError(checkData.debug ? `${checkData.error} [${checkData.debug}]` : (checkData.error || "Login failed."));
        setLoading(false);
        return;
      }

      // Step 2: Supabase client-side auth (sets session cookie)
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error("Supabase auth error:", authError);
        setError(authError.message || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Step 3: Redirect to dashboard
      router.push("/");
      router.refresh();
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <section
      className="auth d-flex flex-wrap"
      style={{ minHeight: "100vh", backgroundColor: "#033457" }}
    >
      <div className="auth-left d-lg-block d-none">
        <div className="d-flex align-items-center flex-column h-100 justify-content-center px-40">
          <div className="text-center">
            <img
              src='/assets/images/botmakers-full-logo.png'
              alt='Botmakers'
              style={{ height: 48, marginBottom: 16 }}
            />
            <p
              className="text-lg"
              style={{ color: "#033457", maxWidth: "400px" }}
            >
              Internal CRM for managing leads, pipeline, proposals, projects,
              and billing.
            </p>
          </div>
        </div>
      </div>
      <div className="auth-right py-32 px-24 d-flex flex-column justify-content-center">
        <div className="max-w-464-px mx-auto w-100">
          <div>
            <div className="mb-40">
              <img
                src='/assets/images/botmakers-logo.png'
                alt='Botmakers CRM'
                style={{ height: 36 }}
              />
            </div>
            <h4 className="mb-12 text-white">Sign In to your Account</h4>
            <p className="mb-32 text-secondary-light text-lg">
              Welcome back! Enter your credentials below.
            </p>
          </div>

          {error && (
            <div
              className="alert d-flex align-items-center gap-2 mb-24 radius-8 py-12 px-16"
              role="alert"
              style={{
                backgroundColor: "rgba(220, 53, 69, 0.15)",
                border: "1px solid rgba(220, 53, 69, 0.3)",
                color: "#ff6b6b",
              }}
            >
              <Icon
                icon="solar:danger-circle-outline"
                className="text-xl flex-shrink-0"
              />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="icon-field mb-16">
              <span className="icon top-50 translate-middle-y">
                <Icon icon="mage:email" />
              </span>
              <input
                type="email"
                className="form-control h-56-px bg-neutral-50 radius-12"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
                autoComplete="email"
              />
            </div>
            <div className="position-relative mb-20">
              <div className="icon-field">
                <span className="icon top-50 translate-middle-y">
                  <Icon icon="solar:lock-password-outline" />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="form-control h-56-px bg-neutral-50 radius-12"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
              </div>
              <span
                className="cursor-pointer position-absolute end-0 top-50 translate-middle-y me-16 text-secondary-light"
                onClick={() => setShowPassword(!showPassword)}
              >
                <Icon
                  icon={showPassword ? "solar:eye-outline" : "solar:eye-closed-outline"}
                  className="text-xl"
                />
              </span>
            </div>
            <button
              type="submit"
              className="btn text-sm btn-sm px-12 py-16 w-100 radius-12 mt-32 d-flex align-items-center justify-content-center gap-8"
              disabled={loading}
              style={{
                backgroundColor: "#03FF00",
                color: "#033457",
                fontWeight: 600,
                border: "none",
              }}
            >
              {loading && (
                <span
                  className="spinner-border spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                />
              )}
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default SignInLayer;
