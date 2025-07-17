import React, { useState, useRef, useEffect } from 'react';

function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { 
      sender: "bot", 
      text: "👋 Bonjour ! Je suis votre assistant IA d'Honest-Inn. Comment puis-je vous aider aujourd'hui ?",
      timestamp: new Date(),
      files: []
    }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(prev => [...prev, ...selectedFiles]); // Allow multiple file selection
  };

  const sendMessage = async () => {
    const messageContent = input.trim();
    const hasFiles = files.length > 0;
    
    if (!messageContent && !hasFiles) return;

    const userMsg = { 
      sender: "user", 
      text: messageContent, 
      timestamp: new Date(),
      files: [...files]
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setFiles([]);
    setIsLoading(true);

    try {
      // Create FormData with consistent field name for files
      const formData = new FormData();
      formData.append('message', messageContent);
      
      // Append all files with the same field name 'files'
      // This will make them available as req.files on the server
      files.forEach((file) => {
        formData.append('files', file);
      });

      // Optional: Add metadata about files
      formData.append('fileCount', files.length.toString());
      formData.append('fileNames', JSON.stringify(files.map(f => f.name)));

      const apiHost = process.env.REACT_APP_API_HOST || 'http://localhost:3001';
      console.log('Sending to:', apiHost);
      
      const response = await fetch(`${apiHost}/chat`, {
        method: "POST",
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Response:', data);
      
      const botMsg = { 
        sender: "bot", 
        text: data.message, 
        timestamp: new Date(),
        files: data.files || []
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      console.error("Erreur lors de l'envoi du message:", error);
      const errorMsg = { 
        sender: "bot", 
        text: "Désolé, une erreur s'est produite. Veuillez réessayer.", 
        timestamp: new Date(),
        files: []
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return timestamp.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return '🖼️';
    if (fileType === 'application/pdf') return '📄';
    if (fileType.startsWith('text/')) return '📝';
    if (fileType.startsWith('video/')) return '🎥';
    if (fileType.startsWith('audio/')) return '🎵';
    return '📁';
  };

  const renderFilePreview = (file) => {
    const fileIcon = getFileIcon(file.type);
    
    if (file.type.startsWith('image/')) {
      return (
        <div className="file-preview image-preview">
          <img 
            src={URL.createObjectURL(file)} 
            alt={file.name} 
            className="preview-image"
            style={{
              maxWidth: '100px',
              maxHeight: '100px',
              objectFit: 'cover',
              borderRadius: '8px'
            }}
          />
          <span className="file-name" style={{ fontSize: '0.8rem' }}>
            {file.name}
          </span>
        </div>
      );
    } else {
      return (
        <div className="file-preview generic-preview">
          <div className="file-icon" style={{ fontSize: '2rem' }}>
            {fileIcon}
          </div>
          <span className="file-name" style={{ fontSize: '0.8rem' }}>
            {file.name}
          </span>
        </div>
      );
    }
  };

  const renderMessageFiles = (messageFiles) => {
    if (!messageFiles || messageFiles.length === 0) return null;
    
    return (
      <div className="message-files" style={{ marginTop: '8px' }}>
        {messageFiles.map((file, index) => (
          <a 
            key={index} 
            href={file.url || URL.createObjectURL(file)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="file-link"
            style={{
              display: 'inline-block',
              margin: '4px',
              textDecoration: 'none',
              color: 'inherit'
            }}
          >
            {renderFilePreview(file)}
          </a>
        ))}
      </div>
    );
  };

  return (
    <div className="chatbot-widget" style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Bouton flottant */}
      {!isOpen && (
        <div 
          className="chat-button" 
          onClick={() => setIsOpen(true)}
          style={{
            position: 'relative',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: '#007bff',
            color: 'white',
            fontSize: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease',
            animation: 'bounce 2s infinite'
          }}
        >
          <div 
            className="notification-badge"
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#ff4444',
              color: 'white',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            1
          </div>
          💬
        </div>
      )}

      {/* Fenêtre de chat */}
      {isOpen && (
        <div 
          className="chat-window" 
          style={{ 
            width: '400px',
            height: isMinimized ? '80px' : '600px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'height 0.3s ease',
            overflow: 'hidden'
          }}
        >
          {/* Header */}
          <div 
            className="chat-header"
            style={{
              padding: '16px',
              backgroundColor: '#007bff',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderRadius: '12px 12px 0 0'
            }}
          >
            <div className="chat-header-info" style={{ display: 'flex', alignItems: 'center' }}>
              <div className="chat-avatar" style={{ marginRight: '12px', fontSize: '24px' }}>
                🤖
              </div>
              <div className="chat-header-text">
                <h3 style={{ margin: 0, fontSize: '16px' }}>Assistant Honest-Inn</h3>
                <p style={{ margin: 0, fontSize: '12px', opacity: 0.8 }}>
                  En ligne • Répond en quelques secondes
                </p>
              </div>
            </div>
            
            <div className="chat-controls" style={{ display: 'flex', gap: '8px' }}>
              <button
                className="chat-control-btn"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Agrandir" : "Minimiser"}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                {isMinimized ? '🔼' : '🔽'}
              </button>
              <button
                className="chat-control-btn"
                onClick={() => setIsOpen(false)}
                title="Fermer"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '4px'
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages */}
              <div 
                className="chat-messages"
                style={{
                  flex: 1,
                  padding: '16px',
                  overflowY: 'auto',
                  backgroundColor: '#f8f9fa'
                }}
              >
                {messages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`message-group ${msg.sender}`}
                    style={{
                      display: 'flex',
                      marginBottom: '16px',
                      alignItems: 'flex-start',
                      justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                    }}
                  >
                    {msg.sender === 'bot' && (
                      <div 
                        className="message-avatar bot"
                        style={{
                          marginRight: '8px',
                          fontSize: '20px'
                        }}
                      >
                        🤖
                      </div>
                    )}
                    <div className="message-content">
                      <div 
                        className={`message-bubble ${msg.sender}`}
                        style={{
                          backgroundColor: msg.sender === 'user' ? '#007bff' : 'white',
                          color: msg.sender === 'user' ? 'white' : 'black',
                          padding: '12px 16px',
                          borderRadius: '18px',
                          maxWidth: '280px',
                          wordWrap: 'break-word',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                        }}
                      >
                        {msg.text && (
                          <p className="message-text" style={{ margin: 0 }}>
                            {msg.text}
                          </p>
                        )}
                        {renderMessageFiles(msg.files)}
                        <p 
                          className={`message-time ${msg.sender}`}
                          style={{
                            margin: '4px 0 0 0',
                            fontSize: '11px',
                            opacity: 0.7
                          }}
                        >
                          {formatTime(msg.timestamp)}
                        </p>
                      </div>
                    </div>
                    {msg.sender === 'user' && (
                      <div 
                        className="message-avatar user"
                        style={{
                          marginLeft: '8px',
                          fontSize: '20px'
                        }}
                      >
                        👤
                      </div>
                    )}
                  </div>
                ))}
                
                {isLoading && (
                  <div 
                    className="message-group bot"
                    style={{
                      display: 'flex',
                      marginBottom: '16px',
                      alignItems: 'flex-start'
                    }}
                  >
                    <div className="message-avatar bot" style={{ marginRight: '8px', fontSize: '20px' }}>
                      🤖
                    </div>
                    <div 
                      className="message-bubble bot"
                      style={{
                        backgroundColor: 'white',
                        padding: '12px 16px',
                        borderRadius: '18px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                    >
                      <div className="typing-indicator" style={{ display: 'flex', gap: '4px' }}>
                        <div className="typing-dot" style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          backgroundColor: '#ccc',
                          animation: 'pulse 1.4s infinite ease-in-out'
                        }}></div>
                        <div className="typing-dot" style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          backgroundColor: '#ccc',
                          animation: 'pulse 1.4s infinite ease-in-out 0.2s'
                        }}></div>
                        <div className="typing-dot" style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          backgroundColor: '#ccc',
                          animation: 'pulse 1.4s infinite ease-in-out 0.4s'
                        }}></div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div 
                className="chat-input-container"
                style={{
                  padding: '16px',
                  backgroundColor: 'white',
                  borderTop: '1px solid #e9ecef'
                }}
              >
                <div className="chat-input-wrapper">
                  <div className="chat-input-area">
                    {files.length > 0 && (
                      <div 
                        className="file-previews"
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '8px',
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: '#f8f9fa',
                          borderRadius: '8px'
                        }}
                      >
                        {files.map((file, index) => (
                          <div 
                            key={index} 
                            className="file-preview"
                            style={{
                              position: 'relative',
                              padding: '8px',
                              backgroundColor: 'white',
                              borderRadius: '8px',
                              border: '1px solid #dee2e6',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              minWidth: '80px'
                            }}
                          >
                            {renderFilePreview(file)}
                            <button 
                              className="file-remove"
                              onClick={() => setFiles(files.filter((_, i) => i !== index))}
                              style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div 
                      className="chat-input-row"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-end',
                        gap: '8px'
                      }}
                    >
                      <button 
                        className="file-input-btn"
                        onClick={() => fileInputRef.current.click()}
                        title="Ajouter un fichier"
                        style={{
                          backgroundColor: '#f8f9fa',
                          border: '1px solid #dee2e6',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        📎
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        style={{ display: 'none' }}
                        multiple
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.txt,.doc,.docx"
                      />
                      
                      <textarea
                        ref={inputRef}
                        className="chat-input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Tapez votre message..."
                        disabled={isLoading}
                        rows={1}
                        style={{
                          flex: 1,
                          border: '1px solid #dee2e6',
                          borderRadius: '20px',
                          padding: '12px 16px',
                          resize: 'none',
                          outline: 'none',
                          fontSize: '14px',
                          minHeight: '40px',
                          maxHeight: '120px',
                          overflowY: 'auto'
                        }}
                      />
                      
                      <button
                        className="chat-send-btn"
                        onClick={sendMessage}
                        disabled={isLoading || (!input.trim() && files.length === 0)}
                        title="Envoyer"
                        style={{
                          backgroundColor: '#007bff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '50%',
                          width: '40px',
                          height: '40px',
                          cursor: 'pointer',
                          fontSize: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: (isLoading || (!input.trim() && files.length === 0)) ? 0.5 : 1
                        }}
                      >
                        ➤
                      </button>
                    </div>
                  </div>
                </div>
                
                <div 
                  className="chat-footer"
                  style={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: '#6c757d',
                    marginTop: '8px'
                  }}
                >
                  Alimenté par l'IA • Honest-Inn © 2025
                </div>
              </div>
            </>
          )}
        </div>
      )}
      
      <style>{`
        .chatbot-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          --primary-color: #EDAF51;
          --primary-dark: #d79a3a;
          --primary-light: #f8c97a;
          --text-color: #2d3748;
          --text-light: #718096;
          --bg-color: #ffffff;
          --border-color: #e2e8f0;
          --bot-bubble: #f7fafc;
          --user-bubble: var(--primary-color);
          --shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        }
        
        .chat-button {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 1000;
          cursor: pointer;
        }
        
        .chat-button-main {
          background: var(--primary-color);
          color: white;
          border-radius: 50%;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: var(--shadow);
          transition: all 0.3s ease;
          position: relative;
          font-size: 36px;
        }
        
        .chat-button-main:hover {
          background: var(--primary-dark);
          transform: scale(1.1);
          box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        }
        
        .chat-button-ping {
          position: absolute;
          inset: 0;
          background: var(--primary-color);
          border-radius: 50%;
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
          opacity: 0.2;
        }
        
        .notification-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ef4444;
          color: white;
          font-size: 14px;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          animation: pulse 2s infinite;
        }
        
        .chat-tooltip {
          position: absolute;
          bottom: 100%;
          right: 0;
          margin-bottom: 12px;
          padding: 10px 16px;
          background: rgba(0,0,0,0.9);
          color: white;
          font-size: 16px;
          border-radius: 12px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.3s;
          pointer-events: none;
        }
        
        .chat-button:hover .chat-tooltip {
          opacity: 1;
        }
        
        .chat-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          right: 20px;
          border: 6px solid transparent;
          border-top-color: rgba(0,0,0,0.9);
        }
        
        .chat-window {
          position: fixed;
          bottom: 30px;
          right: 30px;
          z-index: 1000;
          width: 500px;
          max-width: calc(100vw - 40px);
          background: white;
          border-radius: 20px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.3);
          border: 1px solid var(--border-color);
          transition: all 0.3s ease;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .chat-header {
          background: var(--primary-color);
          color: white;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .chat-header-info {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        
        .chat-avatar {
          width: 50px;
          height: 50px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
        }
        
        .chat-header-text h3 {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 4px 0;
        }
        
        .chat-header-text p {
          font-size: 14px;
          margin: 0;
          opacity: 0.9;
        }
        
        .chat-controls {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .chat-control-btn {
          padding: 10px;
          background: transparent;
          border: none;
          color: white;
          border-radius: 50%;
          cursor: pointer;
          transition: background-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
        }
        
        .chat-control-btn:hover {
          background: rgba(255,255,255,0.2);
        }
        
        .chat-messages {
          flex: 1;
          padding: 20px;
          overflow-y: auto;
          background: var(--bg-color);
          max-height: 60vh;
        }
        
        .message-group {
          margin-bottom: 20px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        
        .message-group.user {
          flex-direction: row-reverse;
        }
        
        .message-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 18px;
          font-weight: 600;
          flex-shrink: 0;
        }
        
        .message-avatar.user {
          background: linear-gradient(135deg, #10b981, #059669);
        }
        
        .message-avatar.bot {
          background: var(--primary-color);
        }
        
        .message-content {
          max-width: 320px;
        }
        
        .message-bubble {
          padding: 16px 20px;
          border-radius: 20px;
          box-shadow: var(--shadow);
          word-wrap: break-word;
        }
        
        .message-bubble.user {
          background: var(--user-bubble);
          color: white;
          border-bottom-right-radius: 4px;
        }
        
        .message-bubble.bot {
          background: var(--bot-bubble);
          border: 1px solid var(--border-color);
          color: var(--text-color);
          border-bottom-left-radius: 4px;
        }
        
        .message-text {
          font-size: 16px;
          line-height: 1.5;
          margin: 0 0 8px 0;
          white-space: pre-wrap;
        }
        
        .message-time {
          font-size: 13px;
          opacity: 0.8;
          margin: 0;
          text-align: right;
        }
        
        .message-time.user {
          color: rgba(255,255,255,0.8);
        }
        
        .message-time.bot {
          color: var(--text-light);
        }
        
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 12px 0;
        }
        
        .typing-dot {
          width: 10px;
          height: 10px;
          background: var(--text-light);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out;
        }
        
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        
        .chat-input-container {
          padding: 20px;
          border-top: 1px solid var(--border-color);
          background: white;
        }
        
        .chat-input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 12px;
        }
        
        .chat-input-area {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .file-previews {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        
        .file-preview {
          position: relative;
          border-radius: 12px;
          overflow: hidden;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          max-width: 120px;
        }
        
        .file-preview img {
          width: 100%;
          height: 80px;
          object-fit: cover;
        }
        
        .file-name {
          display: block;
          font-size: 12px;
          padding: 6px;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        
        .pdf-icon, .file-icon {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 80px;
          font-size: 32px;
        }
        
        .file-remove {
          position: absolute;
          top: 4px;
          right: 4px;
          background: rgba(0,0,0,0.5);
          color: white;
          border: none;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          cursor: pointer;
        }
        
        .chat-input-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .chat-input {
          flex: 1;
          border: 1px solid var(--border-color);
          border-radius: 24px;
          padding: 12px 20px;
          font-size: 16px;
          outline: none;
          transition: all 0.2s;
          min-height: 24px;
          max-height: 120px;
          resize: none;
        }
        
        .chat-input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(237, 175, 81, 0.2);
        }
        
        .file-input-btn {
          background: transparent;
          border: none;
          color: var(--text-light);
          cursor: pointer;
          font-size: 24px;
          transition: color 0.2s;
        }
        
        .file-input-btn:hover {
          color: var(--primary-color);
        }
        
        .chat-send-btn {
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 50%;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s ease;
          font-size: 20px;
        }
        
        .chat-send-btn:hover:not(:disabled) {
          background: var(--primary-dark);
          transform: scale(1.05);
        }
        
        .chat-send-btn:disabled {
          background: #9ca3af;
          cursor: not-allowed;
        }
        
        .chat-footer {
          text-align: center;
          font-size: 14px;
          color: var(--text-light);
          margin-top: 12px;
        }
        
        .message-files {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        
        .file-link {
          text-decoration: none;
          color: inherit;
        }
        
        @keyframes ping {
          75%, 100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: .5;
          }
        }
        
        @keyframes typing {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
        
        @media (max-width: 640px) {
          .chat-window {
            width: calc(100vw - 40px);
            bottom: 20px;
            right: 20px;
          }
          
          .chat-button {
            bottom: 20px;
            right: 20px;
          }
          
          .chat-messages {
            max-height: 50vh;
          }
        }
      `}</style>
    </div>
  );
}

export default ChatbotWidget;