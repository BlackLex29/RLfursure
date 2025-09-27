"use client"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  TotpMultiFactorGenerator,
  type MultiFactorResolver,
  getMultiFactorResolver,
  getAuth,
  type MultiFactorError,
} from "firebase/auth";
import { useState } from "react";
import { auth } from "../firebaseConfig";
import { useRouter } from "next/navigation";
// hehehe
const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(
    null
  );
  const [totpCode, setTotpCode] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const navigate = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMfaRequired(false);

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
        console.log("Account created!");
        navigate.push("/userdashboard");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        console.log("Logged in!");
        navigate.push("/userdashboard");
      }
    } catch (err: any) {
      if (err?.code === "auth/multi-factor-auth-required") {
        // MFA is required - get the resolver
        const mfaResolver = getMultiFactorResolver(
          getAuth(),
          err as MultiFactorError
        );
        setMfaResolver(mfaResolver);
        setMfaRequired(true);
        setError(
          "Multi-factor authentication required. Please enter your TOTP code."
        );
      } else {
        setError(err?.message || "An error occurred during authentication.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaResolver || !totpCode) {
      setError("Please enter a valid TOTP code.");
      return;
    }

    if (totpCode.length !== 6 || !/^\d+$/.test(totpCode)) {
      setError("Please enter a valid 6-digit TOTP code.");
      return;
    }

    setMfaLoading(true);
    setError("");

    try {
      // Get the first available TOTP factor (assuming user has only one)
      const totpFactor = mfaResolver.hints[0];

      if (!totpFactor) {
        throw new Error("No TOTP factor found.");
      }

      // Create the assertion with the TOTP code
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(
        totpFactor.uid,
        totpCode
      );

      await mfaResolver.resolveSignIn(assertion);

      console.log("MFA verification successful!");
      navigate.push("/dashboard");
    } catch (err: any) {
      setError("Invalid TOTP code: " + err.message);
      setTotpCode(""); // Clear the input for retry
    } finally {
      setMfaLoading(false);
    }
  };

  const handleCancelMfa = () => {
    setMfaRequired(false);
    setMfaResolver(null);
    setTotpCode("");
    setError("");
  };

  return (
    <div style={{ maxWidth: "400px", margin: "0 auto", padding: "20px" }}>
      <h2>{isSignUp ? "Sign Up" : "Login"}</h2>

      {!mfaRequired ? (
        <form onSubmit={handleSubmit}>
          <div>
            <label>Email:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", marginBottom: "10px", padding: "8px" }}
            />
          </div>
          <div>
            <label>Password:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", marginBottom: "10px", padding: "8px" }}
            />
          </div>
          {error && (
            <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "10px",
              backgroundColor: loading ? "#ccc" : "#007bff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : isSignUp ? "Sign Up" : "Login"}
          </button>
        </form>
      ) : (
        // MFA Verification Form
        <form onSubmit={handleMfaVerification}>
          <div style={{ marginBottom: "20px" }}>
            <h3>Multi-Factor Authentication Required</h3>
            <p>Please enter the 6-digit code from your authenticator app.</p>
          </div>

          <div>
            <label>TOTP Code:</label>
            <input
              type="text"
              value={totpCode}
              onChange={(e) =>
                setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="123456"
              required
              style={{
                width: "100%",
                marginBottom: "10px",
                padding: "8px",
                fontSize: "18px",
                textAlign: "center",
                letterSpacing: "2px",
              }}
              maxLength={6}
            />
          </div>

          {error && (
            <p style={{ color: "red", marginBottom: "10px" }}>{error}</p>
          )}

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleCancelMfa}
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mfaLoading || totpCode.length !== 6}
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor:
                  mfaLoading || totpCode.length !== 6 ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor:
                  mfaLoading || totpCode.length !== 6
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {mfaLoading ? "Verifying..." : "Verify"}
            </button>
          </div>
        </form>
      )}

      {!mfaRequired && (
        <p style={{ marginTop: "20px", textAlign: "center" }}>
          {isSignUp ? "Already have an account?" : "Don't have an account?"}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError("");
            }}
            style={{
              marginLeft: "5px",
              background: "none",
              border: "none",
              color: "#007bff",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            {isSignUp ? "Login" : "Sign Up"}
          </button>
        </p>
      )}
    </div>
  );
};

export default Login;
