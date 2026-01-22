import React, { useState } from "react";
import Auth from "./Auth";
import Chat from "./Chat";

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