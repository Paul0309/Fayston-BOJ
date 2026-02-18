"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ThemeToggle from "../components/ThemeToggle";
import Icon from "../components/Icon";

const STORAGE_KEYS = {
  users: "usaco_next_users",
  current: "usaco_next_current_user",
};

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key, value) => localStorage.setItem(key, JSON.stringify(value));

export default function AuthPage() {
  const [users, setUsers] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [status, setStatus] = useState({ msg: "", ok: false });
  const [registerForm, setRegisterForm] = useState({ username: "", password: "" });
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  useEffect(() => {
    setUsers(readStorage(STORAGE_KEYS.users, []));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeStorage(STORAGE_KEYS.users, users);
  }, [users, hydrated]);

  function handleRegister(event) {
    event.preventDefault();
    const username = registerForm.username.trim();
    const password = registerForm.password.trim();
    if (!username || !password) {
      setStatus({ msg: "Username and password are required.", ok: false });
      return;
    }
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      setStatus({ msg: "Username already taken.", ok: false });
      return;
    }
    setUsers((prev) => [...prev, { username, password, division: "Bronze" }]);
    setRegisterForm({ username: "", password: "" });
    setStatus({ msg: "Account created — you can now log in.", ok: true });
    setAuthMode("login");
  }

  function handleLogin(event) {
    event.preventDefault();
    const username = loginForm.username.trim();
    const password = loginForm.password.trim();
    const found = users.find(
      (u) => u.username.toLowerCase() === username.toLowerCase() && u.password === password
    );
    if (!found) {
      setStatus({ msg: "Incorrect username or password.", ok: false });
      return;
    }
    writeStorage(STORAGE_KEYS.current, found);
    window.location.href = "/";
  }

  const isLogin = authMode === "login";

  return (
    <div className="auth-page">
      {/* Minimal top-right controls */}
      <div style={{ position: "fixed", top: "1rem", right: "1.25rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <Link href="/" className="btn btn-outline" style={{ fontSize: "0.83rem", padding: "0.38rem 0.7rem" }}>
          <Icon name="home" className="icon" /> Home
        </Link>
        <ThemeToggle />
      </div>

      <div className="auth-card">
        <h2>{isLogin ? "Login" : "Register"}</h2>
        <p className="auth-sub">
          {isLogin
            ? "Sign in to access your contests."
            : "Create an account to get started. All accounts begin at Bronze."}
        </p>

        {isLogin ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label htmlFor="login-user">Username</label>
              <input
                id="login-user"
                autoComplete="username"
                value={loginForm.username}
                onChange={(e) => setLoginForm((p) => ({ ...p, username: e.target.value }))}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="login-pass">Password</label>
              <input
                id="login-pass"
                type="password"
                autoComplete="current-password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <button type="submit" className="auth-submit">
              Login
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label htmlFor="reg-user">Username</label>
              <input
                id="reg-user"
                autoComplete="username"
                value={registerForm.username}
                onChange={(e) => setRegisterForm((p) => ({ ...p, username: e.target.value }))}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="reg-pass">Password</label>
              <input
                id="reg-pass"
                type="password"
                autoComplete="new-password"
                value={registerForm.password}
                onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <button type="submit" className="auth-submit">
              Create Account
            </button>
          </form>
        )}

        {status.msg && (
          <p className={status.ok ? "auth-success" : "auth-error"}>{status.msg}</p>
        )}

        <p className="auth-switch">
          {isLogin ? (
            <>
              Don&apos;t have an account?{" "}
              <button type="button" onClick={() => { setAuthMode("register"); setStatus({ msg: "", ok: false }); }}>
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button type="button" onClick={() => { setAuthMode("login"); setStatus({ msg: "", ok: false }); }}>
                Login
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
