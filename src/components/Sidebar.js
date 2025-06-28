import React from "react";
import "./Sidebar.css";

const Sidebar = ({ agents, activeAgent, onAgentSelect }) => {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Your Agents</h3>
      </div>
      <div className="agents-list">
        {agents.length === 0 ? (
          <div className="no-agents-message">
            No agents created yet. Create your first agent to get started!
          </div>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              className={`agent-item ${
                activeAgent === agent.id ? "active" : ""
              }`}
              onClick={() => onAgentSelect(agent.id)}
            >
              <div className="agent-name">{agent.name || "Unnamed Agent"}</div>
              <div className="agent-description">
                {agent.description
                  ? agent.description.length > 60
                    ? agent.description.substring(0, 60) + "..."
                    : agent.description
                  : "No description"}
              </div>
              {agent.modelName && (
                <div className="agent-model">
                  <span className="model-label">Model:</span> {agent.modelName}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
