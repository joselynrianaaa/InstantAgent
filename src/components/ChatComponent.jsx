import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const ChatComponent = ({ agentId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('http://localhost:8000/chat-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, message: input }),
      });

      const data = await res.json();

      let agentReply = "No response";
      if (data.choices && data.choices.length > 0) {
        agentReply = data.choices[0].message.content;
      }

      const botMessage = { sender: 'agent', text: agentReply };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      const botMessage = { sender: 'agent', text: "⚠️ Error talking to agent." };
      setMessages(prev => [...prev, botMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <div style={{
      background: '#343541',
      color: 'white',
      fontFamily: 'monospace',
      padding: '2rem',
      height: '90vh',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div
        ref={chatContainerRef}
        style={{
          flexGrow: 1,
          overflowY: 'auto',
          marginBottom: '1rem',
        }}
      >
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: '10px',
          }}>
            <div style={{
              background: msg.sender === 'user' ? '#0d6efd' : '#444654',
              padding: '10px 14px',
              borderRadius: '10px',
              maxWidth: '80%',
              whiteSpace: 'pre-wrap',
              color: '#fff',
              boxShadow: '0 1px 5px rgba(0,0,0,0.2)',
            }}>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isTyping && (
          <div style={{ color: '#aaa', fontStyle: 'italic' }}>Agent is typing...</div>
        )}
      </div>

      <div style={{ display: 'flex' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something..."
          style={{
            flexGrow: 1,
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            outline: 'none',
            fontSize: '1rem',
            background: '#202123',
            color: '#fff'
          }}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button
          onClick={sendMessage}
          style={{
            marginLeft: '10px',
            padding: '12px 18px',
            background: '#0d6efd',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatComponent;
