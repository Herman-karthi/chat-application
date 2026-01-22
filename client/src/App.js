import React, { useState } from "react";
import Auth from "./Auth";
import Chat from "./Chat";
import { API_URL } from "./config"; // Import the URL

// Update Socket Connection
const socket = io.connect(API_URL); 

// Update ALL axios calls to use API_URL
// Example:
// const res = await axios.get(`${API_URL}/friends/${user.id}`);
function App() {
  const [user, setUser] = useState(null); // Stores logged-in user info

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      {!user ? (
        <Auth setUser={setUser} />
      ) : (
        <Chat user={user} logout={() => setUser(null)} />
      )}
    </div>
  );
}

export default App;