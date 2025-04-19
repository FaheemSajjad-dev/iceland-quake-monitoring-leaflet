import React, { useState } from "react";
import './MagnitudeScale.css';


const MagnitudeScale = ({ minMagnitude, maxMagnitude, onMagnitudeFilterChange }) => {
    const [showSlider, setShowSlider] = useState(false);
    const [filterValue, setFilterValue] = useState(minMagnitude);
    
    const handleSliderChange = (e) => {
        const value = parseFloat(e.target.value);
        // Invert the value calculation to match the slider position with the filter effect
        const invertedValue = maxMagnitude - (value - minMagnitude);
        setFilterValue(invertedValue);
        if (onMagnitudeFilterChange) {
            onMagnitudeFilterChange(invertedValue);
        }
    };

    const toggleSlider = () => {
        const newShowSlider = !showSlider;
        setShowSlider(newShowSlider);
        
        // If turning off the slider, reset the filter to minimum value
        if (!newShowSlider && onMagnitudeFilterChange) {
            setFilterValue(minMagnitude);
            onMagnitudeFilterChange(minMagnitude);
        } else if (newShowSlider) {
            // When turning on, set to minimum value (which is mapped to maximum slider position)
            setFilterValue(minMagnitude);
            onMagnitudeFilterChange(minMagnitude);
        }
    };

    // Calculate the inverted value for the slider position
    const sliderDisplayValue = maxMagnitude - (filterValue - minMagnitude);
    
    // Calculate the relative position for the filter value box
    // This will position the box at the same height as the slider thumb
    const getFilterBoxPosition = () => {
        const range = maxMagnitude - minMagnitude;
        const valueRatio = (filterValue - minMagnitude) / range;
        // Invert the position since the slider is vertically flipped
        const positionPercentage = (1 - valueRatio) * 100;
        return positionPercentage;
    };

    return (
        <div className="magnitude-scale vertical">
            <span className="max-value">{maxMagnitude.toFixed(1)}</span>
            
            <div className="scale-container">
                <div className="scale-bar-vertical"></div>
                
                {showSlider && (
                    <div className="slider-container" style={{ position: "absolute", width: "100%", height: "100%" }}>
                        <input
                            type="range"
                            min={minMagnitude}
                            max={maxMagnitude}
                            step={0.1}
                            value={sliderDisplayValue}
                            onChange={handleSliderChange}
                            className="magnitude-slider"
                            style={{ 
                                position: "absolute",
                                left: "50%", 
                                top: "50%",
                                width: "200px", 
                                height: "10px",
                                transform: "translate(-48.5%, -50%) rotate(90deg)",
                                margin: 0,
                                padding: 0
                            }}
                        />
                    </div>
                )}
                
                {showSlider && (
                    <div 
                        className="current-filter"
                        style={{
                            position: "absolute",
                            right: "50px",
                            top: `${getFilterBoxPosition()}%`,
                            transform: "translateY(-50%)"
                        }}
                    >
                        <span>{filterValue.toFixed(1)}+</span>
                    </div>
                )}
            </div>
            
            <span className="min-value">{minMagnitude.toFixed(1)}</span>
            
            <button 
                className={`filter-toggle ${showSlider ? 'active' : ''}`}
                onClick={toggleSlider}
                title={showSlider ? "Turn off magnitude filter" : "Turn on magnitude filter"}
            >
                {showSlider ? "×" : "⇄"}
            </button>
        </div>
    );
};

export default MagnitudeScale;