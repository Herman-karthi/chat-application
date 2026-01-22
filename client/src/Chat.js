import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import { API_URL } from "./config"; // <--- IMPORT THIS

// Connect Socket to the Deployment Backend
const socket = io.connect(API_URL);

function Chat({ user, logout }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    socket.on("receive_message", (data) => {
      if (currentChat && (
          (data.sender_id === currentChat.id && data.receiver_id === user.id) || 
          (data.sender_id === user.id && data.receiver_id === currentChat.id)
      )) {
        setMessages((prev) => [...prev, data]);
        scrollToBottom();
      }
    });
    return () => socket.off("receive_message");
  }, [currentChat, user.id]);

  // --- UPDATED FUNCTIONS WITH API_URL ---

  const fetchFriends = async () => {
    // WAS: axios.get("/friends/...")
    // NOW: axios.get(`${API_URL}/friends/...`)
    try {
      const res = await axios.get(`${API_URL}/friends/${user.id}`);
      setFriends(res.data.friends);
      setRequests(res.data.requests);
    } catch (err) {
      console.error("Error fetching friends:", err);
    }
  };

  const handleSearch = async () => {
    try {
      const res = await axios.get(`${API_URL}/search?q=${searchQuery}&currentUserId=${user.id}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error("Search failed:", err);
    }
  };

  const sendRequest = async (receiverId) => {
    try {
      await axios.post(`${API_URL}/friend-request`, { senderId: user.id, receiverId });
      alert("Request Sent!");
    } catch (err) {
      alert("Request already sent or failed.");
    }
  };

  const acceptRequest = async (friendshipId) => {
    try {
      await axios.post(`${API_URL}/accept-friend`, { friendshipId });
      fetchFriends(); // Refresh list
    } catch (err) {
      console.error("Error accepting:", err);
    }
  };

  const openChat = async (friend) => {
    setCurrentChat(friend);
    socket.emit("join_room", { user1: user.id, user2: friend.id });
    try {
      const res = await axios.get(`${API_URL}/messages/${user.id}/${friend.id}`);
      setMessages(res.data);
      scrollToBottom();
    } catch (err) {
      console.error("Error loading chat:", err);
    }
  };

  const sendMessage = async () => {
    if (!newMessage) return;
    const msgData = {
      senderId: user.id,
      receiverId: currentChat.id,
      content: newMessage
    };
    socket.emit("send_message", msgData);
    setNewMessage("");
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // --- UI REMAINS THE SAME ---
  return (
    <div style={{ display: "flex", gap: "20px", height: "80vh", fontFamily: "Arial" }}>
      {/* LEFT SIDEBAR */}
      <div style={{ width: "300px", borderRight: "1px solid #ccc", padding: "10px" }}>
        <h3>Welcome, {user.username} <button onClick={logout} style={{fontSize: "12px"}}>Logout</button></h3>
        
        {/* Search Section */}
        <div style={{ marginBottom: "20px", padding: "10px", background: "#f9f9f9", borderRadius: "8px" }}>
          <input 
            placeholder="Find people..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} 
            style={{ width: "65%", padding: "5px" }}
          />
          <button onClick={handleSearch} style={{ width: "30%", marginLeft: "5px" }}>Search</button>
          
          {/* Search Results List */}
          {searchResults.map(u => (
            <div key={u.id} style={{ padding: "5px", borderBottom: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
              <span>{u.username}</span>
              <button onClick={() => sendRequest(u.id)} style={{ fontSize: "10px" }}>Add</button>
            </div>
          ))}
        </div>

        {/* Requests Section */}
        {requests.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <h4>Friend Requests</h4>
            {requests.map(req => (
              <div key={req.friendship_id} style={{ background: "#eef", padding: "5px", marginBottom: "5px" }}>
                {req.username} <button onClick={() => acceptRequest(req.friendship_id)}>Accept</button>
              </div>
            ))}
          </div>
        )}

        <hr />

        {/* Friends List */}
        <h4>My Friends</h4>
        {friends.map(friend => (
          <div 
            key={friend.id} 
            onClick={() => openChat(friend)} 
            style={{ 
              padding: "10px", 
              cursor: "pointer", 
              background: currentChat?.id === friend.id ? "#007bff" : "transparent",
              color: currentChat?.id === friend.id ? "white" : "black",
              borderRadius: "5px",
              marginBottom: "5px"
            }}
          >
            {friend.username}
          </div>
        ))}
      </div>

      {/* RIGHT SIDE: Chat Window */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {currentChat ? (
          <>
            <div style={{ padding: "10px", background: "#eee", borderBottom: "1px solid #ccc" }}>
              <h3>{currentChat.username}</h3>
            </div>
            
            <div style={{ flex: 1, overflowY: "scroll", padding: "20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {messages.map((msg, index) => (
                <div key={index} style={{ alignSelf: msg.sender_id === user.id ? "flex-end" : "flex-start", maxWidth: "60%" }}>
                  <div style={{ 
                    background: msg.sender_id === user.id ? "#007bff" : "#e5e5ea", 
                    color: msg.sender_id === user.id ? "white" : "black",
                    padding: "10px", 
                    borderRadius: "10px" 
                  }}>
                    {msg.content}
                  </div>
                  <div style={{ fontSize: "10px", color: "#888", textAlign: "right", marginTop: "2px" }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: "20px", borderTop: "1px solid #ccc", display: "flex" }}>
              <input 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..." 
                style={{ flex: 1, padding: "10px", borderRadius: "20px", border: "1px solid #ccc" }}
              />
              <button onClick={sendMessage} style={{ marginLeft: "10px", padding: "10px 20px", borderRadius: "20px", background: "#007bff", color: "white", border: "none" }}>Send</button>
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#ccc" }}>
            <h2>Select a friend to start chatting</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;