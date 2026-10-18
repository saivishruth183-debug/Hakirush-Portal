import React, { useState } from "react";
import axios from "axios";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { apiErrorMessage } from "../utils/apiError";

const INK = "#1C1A17";
const GARNET = "#7A2233";
const GOLD = "#C6A15B";
const HAIRLINE = "#E7DFD2";

const displayFont = { fontFamily: "'Playfair Display', 'Georgia', serif" };
const bodyFont = { fontFamily: "'Inter', 'Helvetica Neue', sans-serif" };

const SetupPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError("Invalid or missing setup token. Please check your email link.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/api/auth/setup-password`, {
        token,
        password
      });

      if (res.data.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate("/login");
        }, 3000);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to setup password. The link may have expired."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FBF8F3] px-4 py-12" style={bodyFont}>
      <div 
        className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-[0_35px_70px_-15px_rgba(28,26,23,0.15)]"
      >
        <div className="h-1.5 w-full" style={{ background: `linear-gradient(90deg, ${GARNET}, ${GOLD} 50%, ${GARNET})` }} />
        
        <div className="p-10">
          <div className="mb-10 text-center">
            <h1 className="text-3xl tracking-tight text-[#1C1A17]" style={{ ...displayFont, fontWeight: 700 }}>
              Hakirush <span className="italic text-[#7A2233]">Portal</span>
            </h1>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-[#B4ADA0]">
              Account Activation
            </p>
          </div>

          {success ? (
            <div className="animate-in fade-in zoom-in-95 text-center duration-500">
              <span
                className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border"
                style={{ borderColor: "#3F5B5440", color: "#3F5B54", backgroundColor: "#3F5B540A" }}
              >
                <CheckCircle2 size={30} strokeWidth={1.5} />
              </span>
              <h2 className="text-xl text-[#1C1A17]" style={{ ...displayFont, fontWeight: 600 }}>
                Password Set Successfully!
              </h2>
              <p className="mt-2 text-sm text-[#8A8378]">Redirecting you to the login page...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-2xl border border-[#7A2233]/20 bg-[#7A2233]/5 p-4 text-center text-xs text-[#7A2233]">
                  {error}
                </div>
              )}
              
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#B4ADA0]">
                  New Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#B4ADA0]">
                    <Lock size={16} strokeWidth={1.5} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full rounded-2xl border bg-white px-11 py-4 text-sm text-[#1C1A17] outline-none transition-all focus:border-[#C6A15B] focus:ring-1 focus:ring-[#C6A15B]"
                    style={{ borderColor: HAIRLINE }}
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-4 text-[#B4ADA0] transition-colors hover:text-[#1C1A17]"
                  >
                    {showPassword ? <EyeOff size={16} strokeWidth={1.5} /> : <Eye size={16} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-[#B4ADA0]">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-[#B4ADA0]">
                    <Lock size={16} strokeWidth={1.5} />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full rounded-2xl border bg-white px-11 py-4 text-sm text-[#1C1A17] outline-none transition-all focus:border-[#C6A15B] focus:ring-1 focus:ring-[#C6A15B]"
                    style={{ borderColor: HAIRLINE }}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-4 w-full cursor-pointer rounded-2xl py-4 text-[10.5px] font-bold uppercase tracking-[0.2em] text-white shadow-[0_16px_32px_-12px_rgba(28,26,23,0.35)] transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50"
                style={{ background: `linear-gradient(155deg, ${INK} 0%, ${GARNET} 100%)` }}
              >
                {loading ? "Saving..." : "Set Password"}
              </button>
            </form>
          )}
        </div>
        
        <div className="border-t bg-[#FBF8F3]/50 p-6 text-center" style={{ borderColor: HAIRLINE }}>
          <p className="text-xs text-[#8A8378]">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#7A2233] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SetupPassword;
