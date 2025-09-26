import React, { useState, useEffect } from 'react';
import './SettingsPanel.css';

const SettingsPanel = ({ settings, onUpdateSettings, onClose }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleChange = (field, value) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setIsSaving(true);
    onUpdateSettings(localSettings);
    setTimeout(() => {
      setIsSaving(false);
      onClose();
    }, 500);
  };

  const languageOptions = [
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'es-ES', label: 'Spanish' },
    { value: 'fr-FR', label: 'French' },
    { value: 'de-DE', label: 'German' },
    { value: 'it-IT', label: 'Italian' },
    { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    { value: 'zh-CN', label: 'Chinese (Mandarin)' },
    { value: 'ja-JP', label: 'Japanese' },
    { value: 'ko-KR', label: 'Korean' },
    { value: 'id-ID', label: 'Bahasa Indonesia' }
  ];

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose} aria-label="Close settings">
            ×
          </button>
        </div>

        <div className="settings-content">
          <div className="setting-group">
            <label htmlFor="wakeWord">Wake Word</label>
            <input
              id="wakeWord"
              type="text"
              value={localSettings.wakeWord}
              onChange={(e) => handleChange('wakeWord', e.target.value.toLowerCase())}
              placeholder="Enter wake word"
            />
            <small>Use lowercase letters only</small>
          </div>

          <div className="setting-group">
            <label htmlFor="sensitivity">Sensitivity Level</label>
            <input
              id="sensitivity"
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={localSettings.sensitivity}
              onChange={(e) => handleChange('sensitivity', parseFloat(e.target.value))}
            />
            <div className="sensitivity-value">{localSettings.sensitivity}</div>
          </div>

          <div className="setting-group">
            <label htmlFor="language">Language</label>
            <select
              id="language"
              value={localSettings.language}
              onChange={(e) => handleChange('language', e.target.value)}
            >
              {languageOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
  
          <div className="setting-group">
            <label htmlFor="useWakeWord">Use Wake Word Detection</label>
            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                id="useWakeWord"
                checked={localSettings.useWakeWord}
                onChange={(e) => handleChange('useWakeWord', e.target.checked)}
              />
              <label htmlFor="useWakeWord" className="checkbox-label">
                Enable wake word detection
              </label>
            </div>
            <small>
              {localSettings.useWakeWord
                ? "Will listen for wake word before activating speech recognition"
                : "Will start speech recognition immediately"}
            </small>
          </div>

          <div className="setting-group">
            <label htmlFor="websocketUrl">WebSocket API URL</label>
            <input
              id="websocketUrl"
              type="url"
              value={localSettings.websocketUrl}
              onChange={(e) => handleChange('websocketUrl', e.target.value)}
              placeholder="Enter WebSocket API URL"
            />
            <small>WebSocket URL for the Cloudflare API endpoint</small>
          </div>
        </div>

        <div className="settings-footer">
          <button className="save-button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;