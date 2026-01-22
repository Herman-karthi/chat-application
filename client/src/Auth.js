import React, { useState } from "react";
import axios from "axios";
import { API_URL } from "./config"; // Import the URL helper

function Auth({ setUser }) {
  // Toggle between Login (true) and Register (false)
  const [isLogin, setIsLogin] = useState(true);
  
  // Form Inputs
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  
  // UI States
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setLoading(true); // Disable button while loading

    // Decide which endpoint to hit
    const endpoint = isLogin ? "/login" : "/register";
    const fullUrl = `${API_URL}${endpoint}`;

    try {
      const res = await axios.post(fullUrl, { username, password });

      if (isLogin) {
        // SUCCESS: Login
        // Save token to localStorage (optional, keeps you logged in on refresh)
        localStorage.setItem("token", res.data.token);
        // Update App state
        setUser(res.data.user);
      } else {
        // SUCCESS: Register
        alert("Registration Successful! Please Login now.");
        setIsLogin(true); // Switch to login view
        setUsername("");
        setPassword("");
      }
    } catch (err) {
      console.error("Auth Error:", err);
      // specific error message from backend OR generic fallback
      const msg = err.response?.data?.error || "Connection Failed. Is Server Running?";
      setError(msg);
    } finally {
      setLoading(false); // Re-enable button
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>{isLogin ? "Login" : "Register"}</h2>
        
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <input 
            style={styles.input}
            placeholder="Username" 
            value={username}
            onChange={e => setUsername(e.target.value)} 
            required
          />
          <input 
            style={styles.input}
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={e => setPassword(e.target.value)} 
            required
          />
          
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "Please wait..." : (isLogin ? "Login" : "Register")}
          </button>
        </form>

        <p style={styles.toggleText}>
          {isLogin ? "New here?" : "Already have an account?"}{" "}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(""); }} 
            style={styles.linkButton}
          >
            {isLogin ? "Create Account" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

// Simple CSS-in-JS styles to make it look decent immediately
const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "80vh",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    padding: "30px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    textAlign: "center",
    width: "300px",
    border: "1px solid #ddd",
  },
  title: {
    marginBottom: "20px",
    color: "#333",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  input: {
    padding: "10px",
    borderRadius: "4px",
    border: "1px solid #ccc",
    fontSize: "16px",
  },
  button: {
    padding: "10px",
    borderRadius: "4px",
    border: "none",
    backgroundColor: "#007bff",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
    fontWeight: "bold",
  },
  error: {
    color: "red",
    marginBottom: "10px",
    fontSize: "14px",
  },
  toggleText: {
    marginTop: "20px",
    fontSize: "14px",
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "#007bff",
    cursor: "pointer",
    textDecoration: "underline",
    fontSize: "14px",
  }
};

export default Auth;