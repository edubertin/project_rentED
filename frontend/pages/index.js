import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { getCurrentUser, login } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function check() {
      const user = await getCurrentUser();
      if (user) {
        router.push("/properties");
      }
    }
    check();
  }, [router]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await login(username, password);
      router.push("/properties");
    } catch (err) {
      setError("Invalid username or password");
    }
  }

  return (
    <div className="container">
      <div className="login-card">
        <img src="/brand/logo.png" alt="rentED" className="login-logo" />
        <p className="login-subtitle">Sign in to continue</p>
        <form onSubmit={handleSubmit} className="login-form">
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <label>Password</label>
          <div className="password-field">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <button type="submit" className="login-submit">Login</button>
        </form>
        {error && <p style={{ color: "salmon" }}>{error}</p>}
      </div>
    </div>
  );
}
