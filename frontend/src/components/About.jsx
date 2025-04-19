import React, { useEffect } from 'react';
import './About.css';

const About = ({ onClose }) => {
  // Close on ESC key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="about-overlay fade-in" role="dialog" aria-modal="true">
      <div className="about-content card">
        <header className="about-header">
          <h2 className="about-title">Iceland MPGV Earthquake Map</h2>
          <button
            className="close-button"
            aria-label="Close About"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="about-body">
          <section className="about-section">
            <h3>Overview</h3>
            <p>
              This app visualizes earthquakes (M ≥ 3.0) across Iceland in
              near real-time, sourced from the Icelandic Met Office (MPGV).
              Browse events by date, view depth cross-sections, and toggle
              volcano locations.
            </p>
          </section>

          <section className="about-section">
            <h3>Contact</h3>
            <p>
              For feedback or support, email{' '}
              <a href="mailto:dummy@quake-monitor.com">dummy@quake-monitor.com</a>
            </p>
          </section>

          <section className="about-section">
            <h3>Credits</h3>
            <ul>
              <li>Lead Developer: --</li>
              <li>Data Integration: --</li>
              <li>UX Design: --</li>
            </ul>
          </section>

          <section className="about-section disclaimer">
            <h3>Disclaimer</h3>
            <p>
              This web application is optimized for desktop browsers and may
              not function correctly on mobile devices. For best experience,
              please use a laptop or desktop computer.
            </p>
          </section>
          
        </div>

        <footer className="about-footer">
          <small>Version 1.0</small>
        </footer>
      </div>
    </div>
  );
};

export default About;