import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";

const socket = io.connect();

function Chat({ user, logout }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentChat, setCurrentChat] = useState(null); // The friend we are talking to
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  
  const messagesEndRef = useRef(null);

  // Load friends and requests on mount
  useEffect(() => {
    fetchFriends();
  }, []);

  // Listen for incoming messages
  useEffect(() => {
    socket.on("receive_message", (data) => {
      // Only append if the message belongs to the current conversation
      if (currentChat && (
          (data.sender_id === currentChat.id && data.receiver_id === user.id) || 
          (data.sender_id === user.id && data.receiver_id === currentChat.id)
      )) {
        setMessages((prev) => [...prev, data]);
        scrollToBottom();
      }
    });
    // Cleanup listener to avoid duplicates
    return () => socket.off("receive_message");
  }, [currentChat, user.id]);

  const fetchFriends = async () => {
    const res = await axios.get(`/friends/${user.id}`);
    setFriends(res.data.friends);
    setRequests(res.data.requests);
  };

  const handleSearch = async () => {
    const res = await axios.get(`/search?q=${searchQuery}&currentUserId=${user.id}`);
    setSearchResults(res.data);
  };

  const sendRequest = async (receiverId) => {
    await axios.post("/friend-request", { senderId: user.id, receiverId });
    alert("Request Sent!");
  };

  const acceptRequest = async (friendshipId) => {
    await axios.post("/accept-friend", { friendshipId });
    fetchFriends();
  };

  const openChat = async (friend) => {
    setCurrentChat(friend);
    // 1. Join Socket Room
    socket.emit("join_room", { user1: user.id, user2: friend.id });
    // 2. Fetch History
    const res = await axios.get(`/messages/${user.id}/${friend.id}`);
    setMessages(res.data);
    scrollToBottom();
  };

  const sendMessage = async () => {
    if (!newMessage) return;
    const msgData = {
      senderId: user.id,
      receiverId: currentChat.id,
      content: newMessage
    };
    // Emit to socket (Backend will save to DB)
    socket.emit("send_message", msgData);
    setNewMessage("");
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* LEFT SIDEBAR: Friends & Search */}
      <div style={{ width: "300px", borderRight: "1px solid #ccc" }}>
        <h3>Welcome, {user.username} <button onClick={logout}>Logout</button></h3>
        
        {/* Search */}
        <div>
          <input placeholder="Search users..." onChange={e => setSearchQuery(e.target.value)} />
          <button onClick={handleSearch}>Search</button>
          {searchResults.map(u => (
            <div key={u.id}>
              {u.username} <button onClick={() => sendRequest(u.id)}>Add</button>
            </div>
          ))}
        </div>

        <hr />
        
        {/* Friend Requests */}
        <h4>Requests</h4>
        {requests.map(req => (
          <div key={req.friendship_id}>
            {req.username} <button onClick={() => acceptRequest(req.friendship_id)}>Accept</button>
          </div>
        ))}

        <hr />

        {/* Friend List */}
        <h4>Friends</h4>
        {friends.map(friend => (
          <div key={friend.id} onClick={() => openChat(friend)} style={{ cursor: "pointer", padding: "5px", background: currentChat?.id === friend.id ? "#ddd" : "transparent" }}>
            {friend.username}
          </div>
        ))}
      </div>

      {/* RIGHT SIDE: Chat Window */}
      <div style={{ flex: 1 }}>
        {currentChat ? (
          <>
            <h3>Chat with {currentChat.username}</h3>
            <div style={{ height: "400px", border: "1px solid black", overflowY: "scroll", padding: "10px" }}>
              {messages.map((msg, index) => (
                <div key={index} style={{ textAlign: msg.sender_id === user.id ? "right" : "left" }}>
                  <span style={{ background: msg.sender_id === user.id ? "#dcf8c6" : "#fff", padding: "5px", borderRadius: "5px" }}>
                    {msg.content}
                  </span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div style={{ marginTop: "10px" }}>
              <input 
                value={newMessage} 
                onChange={(e) => setNewMessage(e.target.value)} 
                placeholder="Type a message..." 
                style={{ width: "80%" }}
              />
              <button onClick={sendMessage} style={{ width: "15%" }}>Send</button>
            </div>
          </>
        ) : (
          <h3>Select a friend to start chatting</h3>
        )}
      </div>
    </div>
  );
}

export default Chat;