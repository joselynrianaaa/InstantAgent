import React, { useState, useEffect } from "react";
import axios from "axios";

const AgentForm = ({ onSubmit, isLoading }) => {
  const availableModels = [
    {
      id: "openai/gpt-3.5-turbo",
      name: "GPT-3.5 Turbo (via OpenRouter)",
    },
    { id: "mistralai/Mistral-7B-Instruct-v0.2", name: "Mistral 7B" },
    { id: "stabilityai/stable-diffusion-2-1", name: "Stable Diffusion 2.1" },
  ];

  // Use the first model as default
  const defaultModel = availableModels.length > 0 ? availableModels[0].id : "";

  const [formData, setFormData] = useState({
    goal: "",
    model: defaultModel,
    tools: [],
    user_name: localStorage.getItem("user_name") || "", // Get from localStorage if exists
    specialization: "", // Add specialization field
  });

  // Save user_name to localStorage when it changes
  useEffect(() => {
    if (formData.user_name) {
      localStorage.setItem("user_name", formData.user_name);
    }
  }, [formData.user_name]);

  const availableTools = [
    { id: "search", name: "Search" },
    { id: "code", name: "Code Generation" },
    { id: "math", name: "Math" },
    { id: "web", name: "Web Browsing" },
    { id: "flight_search", name: "Flight Search" },
    { id: "maps", name: "Maps & Navigation" },
    { id: "finance", name: "Finance & Markets" },
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (type === "checkbox") {
      let updatedTools = [...formData.tools];
      if (checked) {
        updatedTools.push(value);
      } else {
        updatedTools = updatedTools.filter((t) => t !== value);
      }
      setFormData((prev) => ({
        ...prev,
        tools: updatedTools,
      }));
    } else if (name === "model") {
      // When model changes, update the API key if one exists for the selected model
      const selectedModel = availableModels.find((m) => m.id === value);
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const inputStyle = {
    backgroundColor: "#343541",
    color: "white",
    border: "1px solid #343541",
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        backgroundColor: "#2c2d30",
        borderRadius: "12px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
        padding: "24px",
      }}
    >
      <div className="mb-3">
        <label htmlFor="user_name" className="form-label text-white">
          Your Name:
        </label>
        <input
          id="user_name"
          name="user_name"
          type="text"
          className="form-control"
          style={{
            backgroundColor: "#343541",
            color: "white",
            border: "1px solid #343541",
          }}
          value={formData.user_name}
          onChange={handleChange}
          placeholder="Enter your name (optional)"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="goal" className="form-label text-white">
          Goal:
        </label>
        <textarea
          id="goal"
          name="goal"
          className="form-control custom-textarea"
          style={inputStyle}
          value={formData.goal}
          onChange={handleChange}
          placeholder="Describe the agent's goal..."
          required
          rows={1}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="specialization" className="form-label text-white">
          Specialization:
        </label>
        <input
          id="specialization"
          name="specialization"
          type="text"
          className="form-control"
          style={{
            backgroundColor: "#343541",
            color: "white",
            border: "1px solid #343541",
          }}
          value={formData.specialization}
          onChange={handleChange}
          placeholder="e.g. Indian, Ancient Rome, Mathematics, etc. (optional)"
        />
      </div>

      <div className="mb-3">
        <label htmlFor="model" className="form-label text-white">
          Model:
        </label>
        <div style={{ position: "relative" }}>
          <select
            id="model"
            name="model"
            className="form-select"
            style={{
              ...inputStyle,
              appearance: "none",
              paddingRight: "2rem",
            }}
            value={formData.model}
            onChange={handleChange}
            required
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
          <div
            style={{
              position: "absolute",
              right: "20px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "white",
              fontSize: "1rem",
            }}
          >
            ▼
          </div>
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label text-white">Tools:</label>
        <div
          style={{
            backgroundColor: "#343541",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          {availableTools.map((tool) => (
            <div className="form-check" key={tool.id}>
              <input
                className="form-check-input"
                type="checkbox"
                id={`tool-${tool.id}`}
                value={tool.id}
                checked={formData.tools.includes(tool.id)}
                onChange={handleChange}
              />
              <label
                className="form-check-label text-white"
                htmlFor={`tool-${tool.id}`}
              >
                {tool.name}
              </label>
            </div>
          ))}
        </div>
      </div>

      <div className="d-grid">
        <button
          type="submit"
          className="btn"
          style={{
            backgroundColor: "#0d6efd",
            color: "white",
            border: "none",
          }}
          disabled={isLoading}
        >
          {isLoading ? "Creating Agent..." : "Create Agent"}
        </button>
      </div>
    </form>
  );
};

export default AgentForm;
