"use client";

import { useState, useEffect } from "react";

const PASSWORD_KEY = "haccp_auth";
const CORRECT_PASSWORD = "Macarena1984";

export default function PasswordGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(PASSWORD_KEY) === CORRECT_PASSWORD) {
      setUnlocked(true);
    }
    setChecking(false);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (input === CORRECT_PASSWORD) {
      localStorage.setItem(PASSWORD_KEY, CORRECT_PASSWORD);
      setUnlocked(true);
    } else {
      setError(true);
      setInput("");
    }
  }

  if (checking) return null;

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="w-full max-w-sm p-8 bg-white rounded-2xl shadow-sm border border-neutral-200">
        <h1 className="text-xl font-semibold text-neutral-900 mb-1">HACCP Plan Manager</h1>
        <p className="text-sm text-neutral-500 mb-6">Enter the password to continue.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(false); }}
            placeholder="Password"
            autoFocus
            className={`w-full px-4 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-neutral-300 ${
              error ? "border-red-400 bg-red-50" : "border-neutral-300"
            }`}
          />
          {error && <p className="text-xs text-red-500">Incorrect password. Try again.</p>}
          <button
            type="submit"
            className="w-full py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}
