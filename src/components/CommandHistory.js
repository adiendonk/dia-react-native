import React from 'react';
import './CommandHistory.css';

const CommandHistory = ({ history, onClearHistory }) => {
  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="command-history">
      <div className="history-header">
        <h3>Chat History</h3>
        {history.length > 0 && (
          <button className="clear-button" onClick={onClearHistory}>
            Clear History
          </button>
        )}
      </div>
      
      {history.length === 0 ? (
        <div className="empty-history">
          No messages yet. Start speaking to see the chat history here.
        </div>
      ) : (
        <div className="history-list">
          {history.map((item) => (
            <div key={item.id} className={`history-item ${item.role}`}>
              <div className="message-content">
                {item.role === 'user' ? item.command : item.response}
              </div>
              <div className="message-time">{formatTime(item.timestamp)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CommandHistory;