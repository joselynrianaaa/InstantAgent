import React, { useState, useEffect } from "react";
import axios from "axios";
import AgentForm from "./components/AgentForm";
import ResponseDisplay from "./components/ResponseDisplay";
import ChatComponent from "./components/ChatComponent";
import Sidebar from "./components/Sidebar";
import "./App.css";

function App() {
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState("");
  const [error, setError] = useState(null);
  const [activeAgent, setActiveAgent] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [name, setName] = useState(localStorage.getItem("user_name") || "");
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  // Initialize agents state with user-specific storage
  const [agents, setAgents] = useState(() => {
    const userName = localStorage.getItem("user_name");
    if (userName) {
      const userAgents = localStorage.getItem(`agents_${userName}`);
      return userAgents ? JSON.parse(userAgents) : [];
    }
    return [];
  });

  // Initialize chat histories for each agent
  const [agentChats, setAgentChats] = useState(() => {
    const userName = localStorage.getItem("user_name");
    if (userName) {
      const chats = localStorage.getItem(`chats_${userName}`);
      return chats ? JSON.parse(chats) : {};
    }
    return {};
  });

  // Save agents to user-specific storage
  useEffect(() => {
    if (name) {
      localStorage.setItem(`agents_${name}`, JSON.stringify(agents));
    }
  }, [agents, name]);

  // Save chat histories to user-specific storage
  useEffect(() => {
    if (name) {
      localStorage.setItem(`chats_${name}`, JSON.stringify(agentChats));
    }
  }, [agentChats, name]);

  // Handle user session changes
  useEffect(() => {
    if (name) {
      localStorage.setItem("user_name", name);
      // Load user's agents
      const userAgents = localStorage.getItem(`agents_${name}`);
      if (userAgents) {
        setAgents(JSON.parse(userAgents));
      } else {
        setAgents([]);
      }
      // Load user's chat histories
      const userChats = localStorage.getItem(`chats_${name}`);
      if (userChats) {
        setAgentChats(JSON.parse(userChats));
      } else {
        setAgentChats({});
      }
      // Reset active agent when switching users
      setActiveAgent(null);
      setShowChat(false);
    }
  }, [name]);

  const handleLogout = () => {
    setName("");
    setAgents([]);
    setAgentChats({});
    setActiveAgent(null);
    setShowChat(false);
    localStorage.removeItem("user_name");
    localStorage.removeItem("activeAgent");
    setShowDropdown(false);
  };

  // Add deleteAgent function after handleLogout
  const deleteAgent = (agentId) => {
    // Remove agent from agents list
    setAgents((prevAgents) =>
      prevAgents.filter((agent) => agent.id !== agentId)
    );

    // Remove agent's chat history
    setAgentChats((prevChats) => {
      const newChats = { ...prevChats };
      delete newChats[agentId];
      return newChats;
    });

    // If the deleted agent was active, reset the view
    if (activeAgent === agentId) {
      setActiveAgent(null);
      setShowChat(false);
    }
  };

  // Update chat history for specific agent
  const updateAgentChat = (agentId, messages) => {
    setAgentChats((prev) => ({
      ...prev,
      [agentId]: messages,
    }));
  };

  // Check API connectivity when component mounts
  useEffect(() => {
    const checkApiConnectivity = async () => {
      try {
        await axios.get("http://127.0.0.1:8000/", { timeout: 5000 });
        console.log("Backend API is reachable");
      } catch (err) {
        console.error("Cannot connect to backend API:", err);
        setError(
          "Cannot connect to backend API. Please make sure it's running at http://127.0.0.1:8000"
        );
      }
    };

    checkApiConnectivity();

    // Restore active agent from localStorage if it exists
    const savedActiveAgent = localStorage.getItem("activeAgent");
    if (savedActiveAgent) {
      setActiveAgent(savedActiveAgent);
      setShowChat(true);
    }
  }, []);

  // Save active agent to localStorage whenever it changes
  useEffect(() => {
    if (activeAgent) {
      localStorage.setItem("activeAgent", activeAgent);
    }
  }, [activeAgent]);

  const handleSubmit = async (formData) => {
    setLoading(true);
    setLoadingStage("Creating your agent...");
    setError(null);

    try {
      // Add specialization to the goal if provided
      let specialization = "";
      if (formData.specialization) {
        specialization = ` (${formData.specialization})`;
      }

      const result = await axios.post(
        "http://localhost:8000/create-agent",
        {
          ...formData,
          user_name: name, // Include user name in request
        },
        {
          timeout: 30000,
        }
      );

      if (result.data && result.data.agent_id) {
        setActiveAgent(result.data.agent_id);

        // Generate agent name using LLM
        let agentName;
        try {
          setLoadingStage("Generating a name for your agent...");
          const namePromise = generateAgentNameWithLLM(formData.goal);
          agentName = await Promise.race([
            namePromise,
            new Promise((_, reject) => {
              setTimeout(
                () => reject(new Error("Name generation timed out")),
                15000
              );
            }),
          ]);
          setLoadingStage("Name generated: " + agentName);
        } catch (nameError) {
          console.warn("Error generating name:", nameError);
          // Create a fallback name from the goal
          const words = formData.goal.split(/\s+/).filter(Boolean);
          agentName =
            words.length > 0
              ? words[0].charAt(0).toUpperCase() +
                words[0].slice(1) +
                " Assistant"
              : "Custom Assistant";
          setLoadingStage("Using fallback name: " + agentName);
        }

        // Add specialization to the name if provided
        if (formData.specialization) {
          agentName = `${agentName} (${formData.specialization})`;
        }

        // Find the model name from the model ID
        const modelName = formData.model.includes("/")
          ? formData.model.split("/").pop().replace(/-/g, " ")
          : formData.model;

        // Add the new agent to the list
        const newAgent = {
          id: result.data.agent_id,
          name: agentName,
          description: formData.goal,
          model: formData.model,
          modelName: modelName,
          specialization: formData.specialization || "",
          created_at: new Date().toISOString(),
          user_name: name, // Store user name with agent
        };

        setAgents((prevAgents) => [...prevAgents, newAgent]);
        setShowChat(true);
      }
    } catch (err) {
      console.error("Error creating agent:", err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
      setLoadingStage("");
    }
  };

  const handleStartChat = () => {
    const currentAgent = agents.find((agent) => agent.id === activeAgent);
    if (currentAgent) {
      setShowChat(true);
    }
  };

  const handleAgentSelect = (agentId) => {
    setActiveAgent(agentId);
    const selectedAgent = agents.find((agent) => agent.id === agentId);
    if (selectedAgent) {
      setShowChat(true);
    }
  };

  const handleBackToCreate = () => {
    setShowChat(false);
  };

  // Function to generate agent name using the Together API
  async function generateAgentNameWithLLM(goal) {
    if (!goal) return "Custom Assistant";

    try {
      // This uses the same API endpoint format that your backend likely uses
      const response = await fetch("http://localhost:8000/agent-name", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          goal: goal,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate agent name");
      }

      const data = await response.json();
      return data.name || "Custom Assistant";
    } catch (error) {
      console.error("Error generating agent name:", error);

      // Fallback to simple algorithm if API call fails
      const words = goal.split(/\s+/).filter(Boolean);
      const firstTwoWords = words
        .slice(0, 2)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");

      return firstTwoWords ? `${firstTwoWords} Assistant` : "Custom Assistant";
    }
  }

  return (
    <div
      style={{ backgroundColor: "#1e1e1e", minHeight: "100vh", color: "#fff" }}
    >
      {/* Top Navigation */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: "#0d6efd",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "2rem",
            fontWeight: 800,
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          InstantAgent
        </h1>

        {/* Name Dropdown Badge */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setShowDropdown(!showDropdown)}
            style={{
              background: "#fff",
              color: "#0d6efd",
              padding: "0.5rem 1rem",
              borderRadius: "15px",
              fontWeight: "bold",
              fontSize: "1.1rem",
              fontFamily: "'Poppins', sans-serif",
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
            <span>{name || "Sign In"}</span>
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
              {name ? (
                <>
                  <div style={{ marginBottom: "1rem", fontWeight: "500" }}>
                    Signed in as: {name}
                  </div>
                  <button
                    className="btn btn-danger"
                    style={{ width: "100%" }}
                    onClick={handleLogout}
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
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
                    placeholder="e.g. Manjul"
                  />
                  <button
                    className="btn btn-primary mt-2"
                    style={{ width: "100%" }}
                    onClick={() => {
                      const trimmed = inputValue.trim();
                      if (trimmed) {
                        setName(trimmed);
                        setShowDropdown(false);
                        setInputValue("");
                      }
                    }}
                  >
                    Sign In
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Sidebar */}
      <Sidebar
        agents={agents}
        activeAgent={activeAgent}
        onAgentSelect={handleAgentSelect}
        onDeleteAgent={deleteAgent}
      />

      {/* Main Content */}
      <div
        className="main-content"
        style={{ marginLeft: "300px", padding: "80px 2rem 2rem" }}
      >
        {!showChat ? (
          <>
            {/* Create Agent Section */}
            <div className="mb-4">
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
            <div className="mb-4">
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
                  <div className="d-flex justify-content-center flex-column align-items-center">
                    <div
                      className="spinner-border text-light mb-3"
                      role="status"
                    >
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <div className="text-light text-center">
                      <p>{loadingStage || "Loading..."}</p>
                      <small className="text-muted">
                        This might take a minute or two depending on the
                        selected model.
                      </small>
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
          </>
        ) : (
          <div className="chat-container">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <button
                className="btn btn-secondary"
                onClick={handleBackToCreate}
                style={{
                  backgroundColor: "#3a3a3a",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  color: "#fff",
                }}
              >
                ← Back to Create Agent
              </button>
              <h4 style={{ margin: 0, color: "#fff" }}>
                {agents.find((agent) => agent.id === activeAgent)?.name ||
                  "Chat"}
              </h4>
              <div style={{ width: "120px" }}></div>{" "}
              {/* Spacer for alignment */}
            </div>
            <ChatComponent
              agentId={activeAgent}
              agentDetails={agents.find((agent) => agent.id === activeAgent)}
              initialMessages={agentChats[activeAgent] || []}
              onUpdateMessages={(messages) =>
                updateAgentChat(activeAgent, messages)
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
