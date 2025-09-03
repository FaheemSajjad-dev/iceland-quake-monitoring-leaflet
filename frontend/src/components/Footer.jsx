import React from 'react';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    
    return (
        <footer className="app-footer">
            <div className="footer-container">
                <div className="footer-section about">
                    <h3>Iceland Earthquake Monitor</h3>
                    <p>Real-time visualization of seismic activity across Iceland. Data sourced from the Icelandic Meteorological Office.</p>
                </div>
                
                <div className="footer-section links">
                    <h3>Resources</h3>
                    <ul>
                        <li><a href="https://en.vedur.is/" target="_blank" rel="noopener noreferrer">Icelandic Met Office</a></li>
                        <li><a href="https://earthquake.usgs.gov/earthquakes/map/" target="_blank" rel="noopener noreferrer">USGS Earthquake Map</a></li>
                        <li><a href="https://www.nationalgeographic.com/science/article/earthquakes" target="_blank" rel="noopener noreferrer">About Earthquakes</a></li>
                    </ul>
                </div>
                
                <div className="footer-section contact">
                    <h3>Contact</h3>
                    <p>Questions or suggestions?</p>
                    <p><a href="mailto:mfs7@hi.is">mfs7@hi.is</a></p>
                    <div className="social-icons">
                        <a href="#" title="GitHub"><i className="social-icon github">GitHub</i></a>
                        <a href="#" title="Twitter"><i className="social-icon twitter">Twitter</i></a>
                    </div>
                </div>
            </div>
            
            <div className="footer-bottom">
                <p>&copy; {currentYear} Iceland Earthquake Monitoring. All rights reserved.</p>
                <p className="data-disclaimer">Data is updated every 10 seconds. Not for official emergency response.</p>
            </div>
        </footer>
    );
};

export default Footer;