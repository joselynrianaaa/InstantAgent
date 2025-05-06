import React, { useState } from "react";
import axios from "axios";
import AgentForm from "./components/AgentForm";
import ResponseDisplay from "./components/ResponseDisplay";
import ChatComponent from "./components/ChatComponent";
import "./App.css";

function App() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeAgent, setActiveAgent] = useState(null);
  const [showChat, setShowChat] = useState(false);

  const [name, setName] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError(null);
    setShowChat(false);

    try {
      const result = await axios.post(
        "http://127.0.0.1:8000/create-agent",
        formData
      );
      setResponse(result.data);
      if (result.data.agent_id) {
        setActiveAgent(result.data.agent_id);
      }
    } catch (err) {
      let errorMessage;
      if (err.response) {
        errorMessage =
          err.response.data.detail ||
          JSON.stringify(err.response.data) ||
          `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = "No response from server. Is the backend running?";
      } else {
        errorMessage = err.message || "An unknown error occurred";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = () => setShowChat(true);

  return (
    <div
      style={{ backgroundColor: "#1e1e1e", minHeight: "100vh", color: "#fff" }}
    >
      {/* Top Navigation */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 1000,
          backgroundColor: "#0d6efd",
          padding: "2rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "3rem",
            fontWeight: 1000,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          Agent Creation App
        </h1>

        {/* Name Dropdown Badge */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: "#fff",
              color: "#0d6efd",
              padding: "1rem 2rem",
              borderRadius: "15px",
              fontWeight: "bold",
              fontSize: "1.1rem",
              fontFamily: "'Poppins', sans-serif", // ← this line adds Poppins
              cursor: "pointer",
              userSelect: "none",
              boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
              minWidth: "120px",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <span>{name || "Your Name"}</span>
            <span style={{ fontSize: "1rem" }}>▼</span>
          </div>

          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "60px",
                right: 0,
                backgroundColor: "#fff",
                color: "#000",
                borderRadius: "12px",
                padding: "1rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                zIndex: 1001,
                width: "200px",
              }}
            >
              <label
                htmlFor="nameInput"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 500,
                }}
              >
                Enter your name:
              </label>
              <input
                id="nameInput"
                type="text"
                className="form-control"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="e.g. Thikkaloude"
              />
              <button
                className="btn btn-primary mt-2"
                style={{ width: "100%" }}
                onClick={() => {
                  const trimmed = inputValue.trim();
                  if (trimmed) {
                    setName(trimmed);
                    setShowDropdown(false);
                  }
                }}
              >
                Save
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="container-fluid" style={{ padding: "3rem" }}>
        <div className="row">
          {/* Create Agent Section */}
          <div className="col-12 mb-4">
            <div
              style={{
                backgroundColor: "#2c2c2c",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
              }}
            >
              <h4
                style={{
                  color: "#fff",
                  marginBottom: "1.2rem",
                  backgroundColor: "#3a3a3a",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                }}
              >
                Create a New Agent
              </h4>
              <AgentForm onSubmit={handleSubmit} isLoading={loading} />
            </div>
          </div>

          {/* Agent Response Section */}
          <div className="col-12 mb-4">
            <div
              style={{
                backgroundColor: "#2c2c2c",
                borderRadius: "16px",
                padding: "24px",
                boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
              }}
            >
              <h4
                style={{
                  color: "#fff",
                  marginBottom: "1.2rem",
                  backgroundColor: "#3a3a3a",
                  padding: "0.75rem 1rem",
                  borderRadius: "12px",
                }}
              >
                What your Agent can do
              </h4>
              {loading ? (
                <div className="d-flex justify-content-center">
                  <div className="spinner-border text-light" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              ) : error ? (
                <div className="alert alert-danger bg-danger text-white border-0">
                  {error}
                </div>
              ) : (
                <>
                  <ResponseDisplay response={response} />
                  {activeAgent && !showChat && (
                    <div className="d-grid mt-3">
                      <button
                        className="btn"
                        style={{
                          backgroundColor: "#0d6efd",
                          color: "#fff",
                          border: "none",
                        }}
                        onClick={handleStartChat}
                      >
                        Start Chatting with Agent
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Chat Section */}
        {showChat && activeAgent && (
          <div className="row mt-4">
            <div className="col-12">
              <div
                style={{
                  backgroundColor: "#2c2c2c",
                  borderRadius: "16px",
                  padding: "24px",
                  boxShadow: "0 4px 8px rgba(0,0,0,0.2)",
                }}
              >
                <h4
                  style={{
                    color: "#fff",
                    marginBottom: "1.2rem",
                    backgroundColor: "#3a3a3a",
                    padding: "0.75rem 1rem",
                    borderRadius: "12px",
                  }}
                >
                  Chat with your Agent
                </h4>
                <ChatComponent agentId={activeAgent} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
