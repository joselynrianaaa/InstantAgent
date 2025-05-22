import React from "react";

function Sidebar({ agents, activeAgent, onAgentSelect }) {
  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        bottom: 0,
        width: "300px",
        backgroundColor: "#2c2c2c",
        padding: "80px 1rem 1rem",
        overflowY: "auto",
        boxShadow: "2px 0 8px rgba(0,0,0,0.2)",
      }}
    >
      <h5 style={{ color: "#fff", marginBottom: "1rem", padding: "0.5rem" }}>
        Your Agents
      </h5>

      {agents.length === 0 ? (
        <div style={{ color: "#888", padding: "0.5rem" }}>
          No agents created yet. Create your first agent to get started!
        </div>
      ) : (
        <div className="agent-list">
          {agents.map((agent) => (
            <div
              key={agent.id}
              onClick={() => onAgentSelect(agent.id)}
              style={{
                backgroundColor:
                  activeAgent === agent.id ? "#3a3a3a" : "transparent",
                padding: "1rem",
                marginBottom: "0.5rem",
                borderRadius: "8px",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (activeAgent !== agent.id) {
                  e.currentTarget.style.backgroundColor = "#343434";
                }
              }}
              onMouseLeave={(e) => {
                if (activeAgent !== agent.id) {
                  e.currentTarget.style.backgroundColor = "transparent";
                }
              }}
            >
              <div
                style={{
                  color: "#fff",
                  fontWeight: "bold",
                  marginBottom: "0.25rem",
                }}
              >
                {agent.name}
              </div>
              <div style={{ color: "#888", fontSize: "0.9rem" }}>
                {agent.modelName}
              </div>
              <div
                style={{
                  color: "#666",
                  fontSize: "0.8rem",
                  marginTop: "0.25rem",
                }}
              >
                {agent.description}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Sidebar;
